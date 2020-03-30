import express from 'express';

const app = express();

app.listen(process.env.PORT, () => {
  console.info(`Server started on port ${process.env.PORT}`);
});
