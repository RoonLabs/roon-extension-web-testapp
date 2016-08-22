Make sure you have NodeJS 5.x or higher.

Then, modules needed for the Roon API and for the dev tools: 

```bash
npm install
npm install -g browsify
npm install -g watchify
```


To build for deployment:
```bash
npm run build
```

This will generate a bundle.js from your app.js and everything else. You include this bundle.js in your browser.


To build for dev purposes:
```bash
npm run dev
```

This will watch your js and html and update the bundle.js immediately on changes.
