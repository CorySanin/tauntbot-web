import * as http from "http";
import crypto from 'crypto';
import express from 'express';
import type { Express } from 'express';

export interface WebConfig {
    port?: number;
    trustProxy?: string;
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

    constructor(options: WebConfig = {}) {
        this.options = options;
        this.port = notStupidParseInt(process.env['PORT']) || options['port'] as number || 8080;
    }

    initialize = async () => {
        const options = this.options;
        const app: Express = this.app = express();

        app.set('trust proxy', options.trustProxy || false);
        app.set('view engine', 'ejs');
        app.set('view options', { outputFunctionName: 'echo' });
        app.use('/assets', express.static('assets', { maxAge: '30 days' }));
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
                page: {
                    title: 'Web',
                    titlesuffix: 'Home',
                    description: 'Homepage'
                }
            });
        });

        this._webserver = this.app.listen(this.port, () => console.log(`web server is running on port ${this.port}`));
    }

    close = () => {
        if (this._webserver) {
            this._webserver.close();
        }
    }
}

export default Web;
