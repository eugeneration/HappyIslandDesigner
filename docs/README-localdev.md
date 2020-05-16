# Happy Island Designer - Local Development Guide

### First time Setup

Install Dependencies:

- Node
- Yarn

Fork the Happy Island Designer repo on GitHub.

```bash
git clone https://github.com/[your username]/HappyIslandDesigner.git`
cd HappyIslandDesigner
yarn
yarn upgrade paper
```

**Note**: you will probably need to run `yarn upgrade paper` every time you change package.json. I don't know how to fix this yet.

### Development

```bash
yarn dev
```

In your web browser, go to http://localhost:8080/. This will rebuild and hot-reload automatically as you make changes.

### Test build

```bash
yarn build
python -m http.server
```

In your web browser, go to http://localhost:8000/

### Deploy

Create a Pull Request to your repo/branch.

## Other tips

### Testing relative routes

Sometimes webpack can get a little finicky when it comes to relative routes in .scss or .html files. To make sure your relative routes are working, run a server where the HappyIslandDesigner directory is not the root.

```bash
cd HappyIslandDesigner
python -m http.server
```

In your web browser, go to http://localhost:8000/
