import {env} from 'cloudflare:workers';
export function db(){if(!env.DB)throw new Error('Stockage indisponible');return env.DB;}
