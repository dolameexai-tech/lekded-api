const handler = require('./api/index.js');

const req = {
  query: { round: 'xsmvip', force: 'true' }
};

const res = {
  status: function(code) {
    this.statusCode = code;
    return this;
  },
  json: function(data) {
    console.log(`[${this.statusCode}] JSON Response:`, data);
  }
};

console.log("Testing API locally...");
handler(req, res).then(() => {
  console.log("Done.");
});
