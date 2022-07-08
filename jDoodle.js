const request = require("request");
var program = {
  script: "hello",
  versionIndex: "0",
  language: "cpp17",
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
};
// if (language == "c++") {
//   program.language = "cpp17";
//   program.versionIndex = "0";
// } else if (language == "c") {
//   program.language = "c99";
//   program.versionIndex = "4";
// } else if (language == "python") {
//   program.language = "python2";
//   program.versionIndex = "3";
// } else {
//   program.language = "java";
//   program.versionIndex = "0";
// }
request(
  {
    url: "https://api.jdoodle.com/v1/execute",
    method: "POST",
    json: program,
  },
  function (error, response, body) {
    // console.log("error:", error);
    // console.log("statusCode:", response && response.statusCode);
    // console.log("body:", body);

    res.send({ error, response, body });
  }
);
