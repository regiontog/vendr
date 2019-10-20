#!/usr/bin/env node

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const util = require('util');

const mkdir = util.promisify(fs.mkdir);
const exists = util.promisify(fs.exists);

require('yargs') // eslint-disable-line
    .command('add <url>', 'install new vendor file', yargs => {
        yargs
            .positional('url', {
                describe: 'url of vendor file',
            })
    }, add)
    .command('get', 'get all vendor files', yargs => yargs, get)
    .option('verbose', {
        alias: 'v',
        type: 'boolean',
        description: 'Run with verbose logging'
    })
    .argv

function get(argv) {
    const dors = vendors("vendr.json");

    (async () => {
        await Promise.all([...Object.entries(dors).map(async ([url, _]) => {
            try {
                const p = getPath(url);

                if (!(await exists(p))) {
                    const dir = path.dirname(p);
                    await mkdir(dir, { recursive: true });

                    const f = fs.createWriteStream(p);

                    const request = await fetch(url);
                    request.body.pipe(f);
                }
            } catch (e) {
                console.error(e);
            }
        })]);

        const results = await Promise.all(Object.entries(dors).map(async ([url, hash]) => {
            try {
                const p = getPath(url);
                const digest = crypto.createHash("sha512");

                fs.createReadStream(p).pipe(digest);

                const data = await new Promise((resolve, reject) => {
                    digest.on("data", resolve);
                    digest.on("error", reject);
                });

                if (hash === data.toString("hex")) {
                    console.log(`File ${p} with hash ${hash.slice(0, 10)}... `);
                    return false;
                } else {
                    console.error(`File ${p} with incorrect hash!`);
                    return p;
                }
            } catch (e) {
                console.error(e);
            }
        }));

        if (results.some(x => x)) {
            process.exit(-1);
        }
    })();
}

function add(argv) {
    (async () => {
        const dors = vendors("vendr.json");
        const hash = crypto.createHash('sha512');

        const request = await fetch(argv.url);
        request.body.pipe(hash);

        hash.on("data", function (data) {
            if (dors[argv.url]) {
                console.error("Url already added");
                process.exit(-1);
                return;
            }

            dors[argv.url] = data.toString("hex");
            writeVendors("vendr.json", dors);
        });
    })();
}

function getPath(url) {
    url = new URL(url);

    return path.join("vendors", url.hostname, ...url.pathname.split("/"));
}

function writeVendors(file, dors) {
    fs.writeFileSync(file, JSON.stringify(dors, null, 4));
}

function vendors(file) {
    try {
        const content = fs.readFileSync(file);
        const vendors = JSON.parse(content);
        return vendors;
    } catch (err) {
        return {};
    }
}