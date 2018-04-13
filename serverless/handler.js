'use strict';

const crypto = require('crypto');
const assert = require('assert');
const eutil = require("ethereumjs-util");

var fs = require('fs');

const ZELP_KEY = process.env.ZELP_KEY || "the-key",
    ZELP_WEB3_PROVIDER = (process.env.ZELP_WEB3_PROVIDER || "ws://localhost:8545"),
	ZELP_ADDRESS = process.env.ZELP_ADDRESS;

//assert(ZELP_ADDRESS);  // We really can't work without this

function encrypt(plaintext, key) {
	// Based on https://goo.gl/LEwBQW
	const password_hash = crypto.createHash('md5').update(key, 'utf-8').digest('hex').toUpperCase();

	const iv = new Buffer(crypto.randomBytes(16));
	let encryptor = crypto.createCipheriv('aes-256-cbc', password_hash, iv)
    encryptor.setEncoding('hex');
    encryptor.write(JSON.stringify(plaintext));
    encryptor.end();
    const ciphertext = encryptor.read();
	
    let hmac = crypto.createHmac('SHA256', password_hash);
    hmac.update(ciphertext);
    hmac.update(iv.toString('hex')); // both IV and ciphertext are protected by  HMAC

	return [ciphertext, iv, hmac.digest('hex')];
};

function decrypt(input, key) {
	// Based on https://goo.gl/LEwBQW
	const ciphertext = input[0];
	const iv = input[1];
	const hmac = input[2];

	const password_hash = crypto.createHash('md5').update(key, 'utf-8').digest('hex').toUpperCase();

    let chmac = crypto.createHmac('SHA256', password_hash);
    chmac.update(ciphertext);
    chmac.update(iv.toString('hex'));

	if (hmac != chmac.digest('hex')) {
		return null;
	}

	const decipher = crypto.createDecipheriv('aes-256-cbc', password_hash, iv);
	let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
	plaintext += decipher.final('utf8');
	return JSON.parse(plaintext);
}

let ipfs = {};
fs.readFile('default_records.json', 'utf8', function (err, data) {
    const records = JSON.parse(data);
    for (let i = 0; i < records.length; ++i) {
        const record = records[i];
        ipfs[record.id] = encrypt(record.data, record.key);
    }
});
let download = (resource) => ipfs[resource];

function permission(resource, pack, cb) {
	loadZelp((address, abi) => {
		const Web3 = require('web3');

		const web3 = new Web3(ZELP_WEB3_PROVIDER);

	  	const zelp = new web3.eth.Contract(abi, address); //ZELP_ADDRESS);

	    const rsv = eutil.fromRpcSig(pack.signature);

		const consume = zelp.methods.consume(web3.utils.utf8ToHex(resource),
		                                     pack.invoice,
		                                     pack.address,
		                                     eutil.bufferToHex(rsv.r),
		                                     eutil.bufferToHex(rsv.s),
		                                     rsv.v);
	    consume.call().then((result) => {
			// If a const-try fails, don't bother to send()
	    	if (!result) {
	    		throw null;
	    	}
	    })
		.then(() => {
			return web3.eth.getAccounts();
		})
		.then((accounts) => {
			return consume.send({from: accounts[0]});
		})
		.then((result) => {
			// If we wanted to be more secure here, we should poll till the tx-id gets
			// confirmed. Otherwise we're open to double-delivering. For cheap resources
			// it's obviously not worth doing.
			cb(null, result);
		})
		.catch((error) => {
			cb(error, false);
		});
	});
}

function findFile(resource, signature, cb) {
	permission(resource, signature, function(error, result) {
		if (error) {
			cb({"error": `Solidity ${error}`});
			return;
		}

		if (!result) {
			cb({"error": `Can't access resource ${resource}`});
			return;
		}

		let cyphertext = download(resource);
		if (!cyphertext) {
			cb({"error": `${resource} not found in IPFS`});
			return;
		}

		let singleton = decrypt(cyphertext, ZELP_KEY);
		if (!singleton) {
			cb({"error": "IPFS checksums don't match"});
			return;
		}

		let facet = (x) => x;  // In this case identity

		cb({"error": null, "result": facet(singleton)});
    });
};

function loadZelp(cb) {
	fs.readFile('abi.json', 'utf8', function (err,data) {
	  if (err) {
	    return console.log(err);
	  }
	  let contract = JSON.parse(data);
	  cb(contract.address, contract.abi);
	});
};

module.exports.load = (event, context, callback) => {
	let resource = event.pathParameters.rersourceId;
	let signature = {invoice: event.queryStringParameters.invoice,
		             address: event.queryStringParameters.address,
                     signature: event.queryStringParameters.signature};
	function send(result) {
		callback(null, {
			statusCode: 200,
			headers: {'Content-Type': 'application/javascript'},
			body: event.queryStringParameters.callback + '(' + JSON.stringify(result) + ')'
		});
	}

	findFile(resource, signature, function(result) {
		send(result);
	});
};

module.exports.expand = (event, context, callback) => {
	var urlExpand = require('url-expand');
	urlExpand(event.queryStringParameters.url, function (err, url) {
		if (err) {
			callback(err, null);
			return;
		}
		callback(null, {
			statusCode: 200,
			headers: {'Content-Type': 'application/javascript'},
			body: event.queryStringParameters.callback + '(' + JSON.stringify(url) + ')'
		});
	});
}
