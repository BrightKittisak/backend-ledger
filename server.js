require("dotenv").config();

const app = require("./src/app");
const connectToDB = require("./src/config/db");

async function startServer() {
  await connectToDB();

  app.listen(3000, () => {
    console.log("Server is running on port 3000");
  });
}

startServer();
