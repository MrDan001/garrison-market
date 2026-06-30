import bcrypt from "bcrypt";

async function test() {
  const input = "Garrison2026!";
  const hash = "$2b$10$Vnu3lOwGWdU0Y/IBpsmIrOyHUwpeymJwYyq.MBRRz0wjFGTfyC.uK";
  
  const match = await bcrypt.compare(input, hash);
  console.log("Does the password match the hash?", match);
}

test();