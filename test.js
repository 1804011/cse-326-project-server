const { encode, decode } = require("js-base64");

console.log(
  encode(`#include <stdio.h>
 int main(void) {
char name[10];
scanf("%s", name);
printf("hello, %s\n", name);
return 0;
}`)
);
