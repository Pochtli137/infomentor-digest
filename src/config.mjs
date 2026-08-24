/**
 * Config file management.
 *
 * Stores refresh token + child list in ~/.infomentor/config.json.
 * The refresh token rotates on each use and is automatically saved back.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
const CONFIG_DIR = process.env.INFOMENTOR_HOME || join(homedir(), '.infomentor');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');
export function configExists() {
    return existsSync(CONFIG_PATH);
}
export function loadConfig() {
    if (!existsSync(CONFIG_PATH)) {
        throw new Error('No config found. Run `infomentor-login` first to authenticate via BankID.');
    }
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
}
export function saveConfig(config) {
    mkdirSync(CONFIG_DIR, { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}
export function updateRefreshToken(newToken) {
    const config = loadConfig();
    config.refresh_token = newToken;
    saveConfig(config);
}
export function getConfigPath() {
    return CONFIG_PATH;
}
