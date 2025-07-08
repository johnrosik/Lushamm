import app from "./app";
import env from "./util/validateEnv";
import mongoose from 'mongoose';

const port = env.PORT;

mongoose
    .connect(env.MONGO_CONNECTION_STRING)
    .then(() => {
        console.log("Connected to MongoDB successfully!");
        app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
            console.log(`Press Ctrl+C to stop the server`);
        });
    })
    .catch((error) => {
        console.error("Error connecting to MongoDB:", error);
    });
