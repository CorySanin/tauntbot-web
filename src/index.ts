import fs from 'fs';
import path from 'path';
import { parse } from 'yaml';
import { Web, type WebConfig } from './Web.js';

interface compositeConfig {
    web?: WebConfig
}

async function readConfig(): Promise<compositeConfig> {
    try {
        return parse(await fs.promises.readFile(process.env['config'] || process.env['CONFIG'] || path.join(process.cwd(), 'config', 'config.yaml'), 'utf-8'));
    }
    catch (err) {
        console.error('No config file found, using default config');
        console.error(err);
        return {};
    }
}

const config: compositeConfig = await readConfig();

const web = new Web(config.web);
await web.initialize();

process.on('SIGTERM', () => {
    web.close();
});
