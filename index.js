#!/usr/bin/env node
'use strict'; /*jslint node: true, es5: true, indent: 2 */
var async = require('async');
var fs = require('fs');
var logger = require('winston');
var mkdirp = require('mkdirp');
var path = require('path');
var request = require('request');
var url = require('url');

function readLines(stream, callback) {
  // callback signature: callback(err, lines)
  var buffer = '';
  stream.setEncoding('utf8');
  stream.on('error', function(err) {
    callback(err);
  });
  stream.on('data', function(chunk) {
    buffer += chunk;
  });
  stream.on('end', function() {
    callback(null, buffer.trim().split('\n'));
  });
}

var url2Filename = module.exports.url2Filename = function(urlStr) {
  // returns a filename (not a filepath)
  // currently transforms something like
  //   https://s3.west..omename/...asiu/2012/05/07/15/10_activities.json.gz?AWSAccessKeyId=this&Expires=then&Signature=that
  // to
  //   2012-05-07T15-10_activities.json.gz
  // override this with your own transform!
  var urlObj = url.parse(urlStr);

  // CHANGE THIS REGEX FOR YOUR OWN URLS! this is very customized for exactly my use-case.
  var m = urlObj.pathname.match(/(\d{4})\/(\d{2})\/(\d{2})\/(\d{2})\/(\d+)_(\w+\.json\.gz)/);
  if (!m)
    throw new Error('Could not find expected filename in url: ' + urlObj.pathname);

  var date = m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + '-' + m[5];
  return date + '_' + m[6];
};

function downloadUrl(urlStr, filepath, callback) {
  var tmp_filepath = filepath + '.tmp';

  var file = fs.createWriteStream(tmp_filepath);

  logger.debug(tmp_filepath + ' starting');

  var req = request.get(urlStr);
  req.on('error', function(err) {
    callback(err);
  });
  req.on('response', function(res) {
    res.on('error', function(err) {
      callback(err);
    });
    res.pipe(file).on('finish', function() {
      logger.debug(tmp_filepath + ' done');
      fs.rename(tmp_filepath, filepath, function(err) {
        logger.debug(tmp_filepath + ' moved to ' + filepath);
        callback(err);
      });
    });
  });
}

function ensureUrl(urlStr, dirpath, callback) {
  // callback signature: function(err)

  var local_filename = url2Filename(urlStr);
  var local_filepath = path.join(dirpath, local_filename);

  fs.exists(local_filepath, function (exists) {
    if (exists) {
      logger.debug(local_filepath + ' already exists');
      callback();
    }
    else {
      downloadUrl(urlStr, local_filepath, callback);
    }
  });
}

var downloadUrls = module.exports.downloadUrls = function(dirpath, limit, urls, callback) {
  var processed = 0;
  var q = async.queue(function (url, callback) {
    logger.debug('task #' + (++processed) + ' (' + q.length() + ' left, ' + urls.length + ' total)');
    ensureUrl(url, dirpath, callback);
  }, limit);

  q.drain = function() {
    callback();
  };

  q.push(urls, function(err) {
    if (err) {
      logger.error(err.toString(), err);
    }
  });
};

if (require.main === module) {
  var argv = require('optimist')
    .usage([
      'Download a list of urls, specified on STDIN',
      '',
      'Usage: <urls.txt mget [options]',
      '',
      'Options:',
      '  -c, --concurrency 10    number of downloads to perform at one time',
      '  -d, --directory .       destination directory (must already exist)',
      '  -v, --verbose           log more events',
      '',
      'Only STDIN is supported, and it is coerced to utf8',
    ].join('\n'))
    .alias({
      c: 'concurrency',
      d: 'directory',
      v: 'verbose',
    })
    .boolean('verbose')
    .default({
      concurrency: 10,
      directory: '.',
    })
    .argv;

  if (argv.verbose) {
    logger.level = 'debug';
  }

  logger.debug('argv', argv);

  mkdirp(argv.directory, function(err) {
    if (err) {
      logger.error('Directory could not be created / accessed. ' + err.toString());
    }
    else {
      logger.debug('Directory created / already exists: ' + argv.directory);
      readLines(process.stdin, function(err, urls) {
        if (err) {
          logger.error('Could not read from STDIN. ' + err.toString());
        }
        else {
          logger.info('Downloading ' + urls.length + ' urls');
          downloadUrls(argv.directory, argv.limit, urls, function() {
            logger.info('Done');
          });
        }
      });
    }
  });
}
