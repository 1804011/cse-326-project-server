const { encode, decode } = require("js-base64");
const request = require("request");

const createSubmission = async (req, res, next) => {
  const { id } = req.params;
  //console.log(id);
  const {
    source_code,
    language_id,
    stdin,
    cpu_time_limit,
    memory_limit,
    cpu_extra_time,
  } = req?.body;
  let submissions = [];
  for (let i = 0; i < stdin?.length; i++) {
    const obj = {
      language_id,
      cpu_extra_time,
      cpu_time_limit,
      memory_limit,
      source_code: encode(source_code),
      stdin: encode(stdin[i]),
    };
    submissions.push(obj);
  }

  const options = {
    method: "POST",
    url: "https://judge0-ce.p.rapidapi.com/submissions/batch",
    qs: { base64_encoded: "true", wait: true },
    headers: {
      "content-type": "application/json",
      "Content-Type": "application/json",
      "X-RapidAPI-Key": "bb3bc57c10msh7671e8aa266b04ep1ce70cjsn4633aaf3b2b8",
      "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
      useQueryString: true,
    },
    body: {
      // submissions: [
      //   { language_id: 46, source_code: "ZWNobyBoZWxsbyBmcm9tIEJhc2gK" },
      //   {
      //     language_id: 71,
      //     source_code: "cHJpbnQoImhlbGxvIGZyb20gUHl0aG9uIikK",
      //   },
      //   { language_id: 72, source_code: "cHV0cygiaGVsbG8gZnJvbSBSdWJ5IikK" },
      // ],
      submissions,
    },
    json: true,
  };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);
    //console.log(body);
    req.tokens = body;
    next();
  });
};
const getSubmission = async (req, res, next) => {
  let string = "";
  let sz = req?.tokens?.length;
  for (let i = 0; i < sz; i++) {
    if (i == sz - 1) {
      string += req?.tokens[i]?.token;
    } else {
      string = string + req?.tokens[i]?.token + ",";
    }
  }

  setTimeout(() => {
    const options = {
      method: "GET",
      url: "https://judge0-ce.p.rapidapi.com/submissions/batch",
      qs: {
        tokens: string,
        base64_encoded: "true",
        fields:
          "stdin,source_code,stdout,memory,time,token,status,message,compile_output",
      },
      headers: {
        "X-RapidAPI-Key": "bb3bc57c10msh7671e8aa266b04ep1ce70cjsn4633aaf3b2b8",
        "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
        useQueryString: true,
      },
    };
    request(options, function (error, response, body) {
      if (error) throw new Error(error);

      ////console.log(JSON.parse(body));
      ////console.log(body);
      req.body.result = JSON.parse(body);

      next();
    });
  }, 15000);
};
module.exports = {
  createSubmission,
  getSubmission,
};
