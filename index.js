#!/usr/bin/env node

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

    for ([url, hash] of Object.entries(dors)) {
        const p = getPath(url);
        const digest = crypto.createHash('sha512');

        if (fs.existsSync(p)) {
            fs.createReadStream(p).pipe(digest);

            digest.on("data", function (data) {
                if (hash === data.toString("hex")) {
                    console.log(`Existing file ${p} with hash ${hash.slice(0, 10)}... `);
                } else {
                    console.error(`Existing file ${p} with incorrect hash!`);
                    process.exit(-1);
                }
            });
        } else {
            fs.mkdirSync(path.dirname(p), { recursive: true });
            const f = fs.createWriteStream(p);

            const request = download(url, function (response) {
                response.pipe(f);
                response.pipe(digest);
            });

            digest.on("data", function (data) {
                if (hash === data.toString("hex")) {
                    console.log(`Downloaded ${url} with hash ${hash.slice(0, 10)}... `);
                } else {
                    console.error(`${url} hash does does not match added file.`);
                    fs.unlinkSync(p);
                    process.exit(-1);
                }
            });
        }
    }
}

function add(argv) {
    const dors = vendors("vendr.json");

    const hash = crypto.createHash('sha512');

    const request = download(argv.url, function (response) {
        response.pipe(hash);
    });

    hash.on("data", function (data) {
        if (dors[argv.url]) {
            console.error("Url already added");
            process.exit(-1);
            return;
        }

        dors[argv.url] = data.toString("hex");
        writeVendors("vendr.json", dors);
    });
}

function download(url, ...args) {
    url = new URL(url);
    const client = url.protocol == "https:" ? https : http;

    return client.get(url, ...args);
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