import * as http from "http";
import fs from 'fs';
import crypto from 'crypto';
import { LRUCache } from 'lru-cache'
import express from 'express';
import type { Express } from 'express';

export interface WebConfig {
    port?: number;
    trustProxy?: string;
    supportUrl?: string;
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

        app.set('trust proxy', options.trustProxy || false);
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

        app.get('/', (_, res) => {
            res.render('index', {
                inliner: this.inliner,
                page: {
                    title: 'Taunt Bot for Discord',
                    titlesuffix: 'Celebrate your Victories',
                    description: 'Hear your winning anthem in Discord voice chat. Upload your own audio clips for the bot to play.'
                }
            });
        });

        if (options.supportUrl) {
            const supportUrl = options.supportUrl;
            app.get('/discord', (_, res) => {
                res.redirect(supportUrl);
            });
        }

        app.use('/assets', express.static('assets', { maxAge: '30 days' }));

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

    close = () => {
        if (this._webserver) {
            this._webserver.close();
        }
    }
}

export default Web;
