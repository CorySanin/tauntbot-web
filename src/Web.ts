import * as http from "http";
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { LRUCache } from 'lru-cache'
import express from 'express';
import type { Express } from 'express';
import type { stats } from 'tauntbot';

export interface WebConfig {
    port?: number;
    trustProxy?: string;
    supportUrl?: string;
    clientId?: string;
    permissions?: number;
    statsDir?: string;
}

export interface TbStatsFile {
    today: stats.TauntStats;
    year: stats.TauntStats;
}

interface CommandDetails {
    slashCommand: `/${string}`;
    description: string;
}

/**
 * I still hate typescript.
 */
export function notStupidParseInt(v: string | undefined): number {
    return v === undefined ? NaN : parseInt(v);
}

export class Web {
    private _webserver: http.Server | null = null;
    private app: Express | null = null;
    private port: number;
    private options: WebConfig;
    private assetCache: LRUCache<string, string>;

    constructor(options: WebConfig = {}) {
        this.options = options;
        this.port = notStupidParseInt(process.env['PORT']) || options['port'] as number || 8080;
        this.assetCache = new LRUCache({
            max: 15,
            allowStale: true
        });
    }

    initialize = async () => {
        const options = this.options;
        const app: Express = this.app = express();

        app.set('trust proxy', options.trustProxy ?? false);
        app.set('view engine', 'ejs');
        app.set('view options', { outputFunctionName: 'echo' });
        app.get('/favicon.ico', (_, res) => {
            res.sendFile(path.join(process.cwd(), 'assets', 'icons', 'favicon.ico'));
        });
        app.use((_req, res, next) => {
            crypto.randomBytes(32, (err, randomBytes) => {
                if (err) {
                    console.error(err);
                    next(err);
                } else {
                    res.locals['cspNonce'] = randomBytes.toString("hex");
                    next();
                }
            });
        });

        app.get('/healthcheck', (_, res) => {
            res.send('Healthy');
        });

        app.get('/', async (_req, res) => {
            res.render('index', {
                inliner: this.inliner,
                page: {
                    title: 'Taunt Bot for Discord',
                    titlesuffix: 'Celebrate your Victories',
                    description: 'Hear your winning anthem in Discord voice chat. Upload your own audio clips for the bot to play.'
                },
                connectUrl: options.clientId && `https://discordapp.com/oauth2/authorize?client_id=${options.clientId}&scope=bot&permissions=${options.permissions ?? 3165184}`,
                stats: await this.getStatsBody(),
                commands: [
                    {
                        slashCommand: '/win',
                        description: 'Plays your victory track'
                    },
                    {
                        slashCommand: '/mvp',
                        description: 'Plays your mvp track'
                    },
                    {
                        slashCommand: '/lose',
                        description: 'Plays your lose track'
                    }
                ] satisfies CommandDetails[]
            });
        });

        const statsEndpoint = async (_req: express.Request, res: express.Response) => {
            res.send(await this.getStatsBody());
        }

        app.get('/stats.json.php', statsEndpoint);
        app.get('/stats.json', statsEndpoint);

        if (options.supportUrl) {
            const supportUrl = options.supportUrl;
            app.get('/discord', (_, res) => {
                res.redirect(supportUrl);
            });
        }

        app.use('/assets', express.static('assets', { maxAge: '30 days' }));

        app.use((_req, res) => {
            res.status(404).render('error', {
                inliner: this.inliner,
                page: {
                    title: '404',
                    titlesuffix: 'Taunt Bot for Discord'
                },
                httpStatus: '404',
                httpStatusMessage: 'File not found.'
            });
        });

        this._webserver = this.app.listen(this.port, () => console.log(`web server is running on port ${this.port}`));
    }

    private inliner = (file: string) => {
        const cache = this.assetCache;
        const fromCache = cache.get(file);
        if (fromCache) {
            return fromCache;
        }
        const fromDisk = fs.readFileSync(file, { encoding: 'utf-8' });
        cache.set(file, fromDisk);
        return fromDisk;
    }

    private async readStats() {
        try {
            const contents = await fs.promises.readFile(path.join(this.options.statsDir ?? 'stats', 'stats.json'), { encoding: 'utf-8' });
            return JSON.parse(contents) as TbStatsFile;
        }
        catch {
            return null;
        }
    }

    private async getServerCount() {
        try {
            const contents = await fs.promises.readFile(path.join(this.options.statsDir ?? 'stats', 'serverCount.txt'), { encoding: 'utf-8' });
            return notStupidParseInt(contents.trim());
        }
        catch {
            return -1;
        }
    }

    private async getStatsBody() {
        const body = {
            server_count: await this.getServerCount(),
            year_taunts: -1
        };
        const yearTaunts = (await this.readStats())?.year;
        if (yearTaunts) {
            body.year_taunts = (yearTaunts.intro ?? 0) + (yearTaunts.lose ?? 0) + (yearTaunts.mvp ?? 0) + (yearTaunts.victory ?? 0)
        }
        return body;
    }

    close = () => {
        if (this._webserver) {
            this._webserver.close();
        }
    }
}

export default Web;
