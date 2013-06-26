# parallel-wget

## Install

```bash
npm install -g git://github.com/chbrown/parallel-wget.git
```

## Use

First, customize the url transform function:

```javascript
var wget = require('parallel-wget');
wget.url2Filename = function(urlStr) {
  return urlStr.replace(/\//g, '-');
}

wget.downloadUrls('.', 50, urls_array, function() {
  logger.info('Done');
});
```

Or use from the command line like:

```bash
<allurls.txt parallel-wget -d tmp --concurrency 50
```

## License

Copyright © 2011–2013 Christopher Brown. [MIT Licensed](LICENSE).
