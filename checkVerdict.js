const { encode, decode } = require("js-base64");

const compareOutput = (output1, output2) => {
  console.log(output1, output2);
  let stdout = [];
  for (let i = 0; i < output1?.length; i++) {
    if (output1[i].status.id !== 3) {
      return output1[i].status.description;
    } else {
      stdout.push(output1[i].stdout);
    }
  }
  if (stdout.length !== output2.length) {
    return "wrong answer";
  }
  for (i = 0; i < output2.length; i++) {
    let txt1 = decode(stdout[i])
      .replaceAll("\n", " ")
      .split(" ")
      .filter((txt) => txt !== "")
      .map((txt) => txt.toLowerCase());
    let txt2 = output2[i]
      .replaceAll("\n", " ")
      .split(" ")
      .filter((txt) => txt !== "")
      .map((txt) => txt.toLowerCase());
    if (JSON.stringify(txt1) !== JSON.stringify(txt2)) {
      return `wrong answer on test ${i + 1}`;
    }
  }
  return "Accepted";
};
module.exports = { compareOutput };
