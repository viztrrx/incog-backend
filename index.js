const fs = require('fs');
const config = require('./config.json');
const fastify = require('fastify')({
    ignoreTrailingSlash: true,
    https: config.ssl ? { 
        cert: fs.readFileSync('./ssl.cert', 'utf-8'),
        key: fs.readFileSync('./ssl.key', 'utf-8'),
    } : false,
});
// Corrosion bundles its client with webpack 4, which hashes with md4 (removed in OpenSSL 3 / Node 17+).
const crypto = require('crypto');
const createHash = crypto.createHash;
crypto.createHash = (algorithm, ...args) => createHash(algorithm == 'md4' ? 'sha256' : algorithm, ...args);
const Corrosion = require('corrosion');
const https = require('https');
const corrosion = new Corrosion({
    prefix: config.prefix || '/service/',
    codec: config.codec || 'xor',
    requestMiddleware: [
        Corrosion.middleware.blacklist((config.blacklist || [])),
        Corrosion.middleware.address((config.addresses || [])),
    ]
});
const base64 = {
    encode(val){
        if (typeof val != 'string') return val;
        return Buffer.from(val).toString('base64');
    },
    decode(val){
        if (typeof val != 'string') return val;
        return Buffer.from(val, 'base64').toString('utf-8');
    },
};
const engines = {
    google: 'https://www.google.com/search?q=',
    youtube: 'https://www.youtube.com/results?search_query=',
    bing: 'https://www.bing.com/search?q=',
    brave: 'https://search.brave.com/search?q=',
    twitter: 'https://twitter.com/search?q=',
    reddit: 'https://www.reddit.com/search/?q=',
};

fastify.register(require('fastify-cookie'));
fastify.register(require('fastify-formbody'));

// The frontend is hosted separately, so it needs CORS to call the API.
fastify.addHook('onRequest', (request, reply, done) => {
    reply.header('Access-Control-Allow-Origin', config.cors || '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');
    if (request.method == 'OPTIONS') return reply.code(204).send();
    done();
});

fastify.get('/', (request, reply) => reply.type('application/json').send({ name: 'incognito-backend', status: 'ok' }));

fastify.get('/gateway/', (request, reply) => gateway(request, reply, base64.decode((request.query.url || ''))));
fastify.post('/gateway/', (request, reply) => gateway(request, reply, typeof request.body == 'object' ? request.body.url : request.body));

fastify.post('/suggestions/', (request, reply) => {
    const val = typeof request.body == 'object' ? request.body.q : request.body;
    const fail = err => reply.code(500).type('application/json').send({ error: err.toString() });
    try {
        https.request(`https://duckduckgo.com/ac/?q=${encodeURIComponent(val)}`, {}, async resp => {
            const send = await getChunks(resp);
            reply.code(200).type('application/json').send(send);
        }).on('error', fail).end();
    } catch(err) {
        fail(err);
    };
});

if (config.proxy) {
    fastify.register(require('fastify-express')).then(() => {
        fastify.use((req, res, next) => {
            if (req.url.startsWith(corrosion.prefix)) { 
                if (config.authorization && req.headers.cookie) {
                    const cookies = parseCookies(req.headers.cookie);
                    if (!cookies.has(config.authorization.name) || cookies.get(config.authorization.name) != config.authorization.value) {
                        res.status(401);
                        return res.send('');
                    };
                };
                corrosion.request(req, res);
            } else next();
        });
    });
    fastify.server.on('upgrade', corrosion.upgrade);
};

fastify.listen((process.env.PORT || config.port), '0.0.0.0', (err, address) => {
    if (err) {
        throw err;
    } else {
        console.log(`Incognito backend running on ${address}`)
    };
});

function gateway(request, reply, val) {
    // The engine cookie lives on the frontend's domain, so the frontend passes it as a query parameter.
    const engine = request.query.engine || request.cookies.engine || config.engine;
    const url = isUrl(val) ? (new URL(/^http(s?):\/\//.test(val) ? val : 'http://' + val).href) : `${engines[engine] || engines.google}${val}`;
    if (config.authorization) reply.header('Set-Cookie', `${config.authorization.name}=${config.authorization.value}; Domain=${request.headers.host};`);
    reply.header('Location', rewriteUrl(url));
    reply.status(301);
    reply.send('');
};

function isUrl(val = ''){
    if (/^http(s?):\/\//.test(val) || val.includes('.') && val.substr(0, 1) != ' ') return true;
    return false;
};

function getChunks(stream){
    var raw = [];
    return new Promise(resolve => 
        stream.on('data', data => 
            raw.push(data)
        ).on('end', () =>
            raw.length ? resolve(Buffer.concat(raw)) : resolve(null)
        )
    );
};

function parseCookies(str = '') {
    const map = new Map();
    str.split('; ').forEach(cookie => map.set(...cookie.split('=')));
    return map;
};

function rewriteUrl(str = '', origin = '') {
    return origin + corrosion.prefix + corrosion.codec.encode(str); 
};
