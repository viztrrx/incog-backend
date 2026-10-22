# Incognito Backend

The server half of [Incognito](https://github.com/titaniumnetwork-dev/Incognito-old), split out from the original monorepo. It runs the [Corrosion](https://github.com/titaniumnetwork-dev/Corrosion) web proxy and the small API the frontend calls. It serves no HTML; the UI lives in [incog-frontend](https://github.com/viztrrx/incog-frontend).

## Setup

```sh
git clone https://github.com/viztrrx/incog-backend
cd incog-backend
npm install
npm start
```

The server listens on `PORT` or `config.port` (default `8080`).

## Endpoints

| Route | Description |
| --- | --- |
| `GET /` | Health check |
| `GET /gateway/?url=<base64>&engine=<name>` | Turns a URL or search query into a proxied URL and redirects to it. `engine` is optional (`google`, `youtube`, `bing`, `brave`, `twitter`, `reddit`) |
| `POST /gateway/` | Same, with `url` in a form body |
| `POST /suggestions/` | Search suggestions (DuckDuckGo autocomplete) for the plain-text body |
| `/service/*` | Corrosion proxy (when `proxy` is `true`) |

## Config

```json
{
    "port": 8080,
    "ssl": false,
    "prefix": "/service/",
    "codec": "xor",
    "proxy": true,
    "blacklist": [],
    "addresses": [],
    "authorization": {
        "name": "__incog_auth",
        "value": "1"
    },
    "engine": "google",
    "cors": "*"
}
```

- `port` HTTP server port
- `ssl` (true / false) HTTPS using `ssl.cert` and `ssl.key`
- `prefix` Corrosion proxy prefix
- `codec` Corrosion proxy codec
- `proxy` (true / false) Host Corrosion on this server
- `blacklist` Hostnames to block
- `addresses` Local addresses to make outgoing requests from
- `authorization` Cookie the gateway sets and the proxy requires
- `engine` Default search engine when the frontend doesn't send one
- `cors` `Access-Control-Allow-Origin` value. Set this to your frontend's origin (e.g. `https://incognito.example.com`) in production
