/* eslint-env node */
/* eslint-disable import/no-commonjs */

require("babel-register");
require("core-js/stable");
require("regenerator-runtime/runtime");

const webpack = require("webpack");

const ExtractTextPlugin = require("extract-text-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const HtmlWebpackHarddiskPlugin = require("html-webpack-harddisk-plugin");
const UnusedFilesWebpackPlugin = require("unused-files-webpack-plugin").default;
const BannerWebpackPlugin = require("banner-webpack-plugin");
const UglifyJSPlugin = require("uglifyjs-webpack-plugin");
const WebpackNotifierPlugin = require("webpack-notifier");

const fs = require("fs");

const ASSETS_PATH = __dirname + "/resources/frontend_client/app/assets";
const FONTS_PATH = __dirname + "/resources/frontend_client/app/fonts";
const SRC_PATH = __dirname + "/frontend/src/metabase";
const LIB_SRC_PATH = __dirname + "/frontend/src/metabase-lib";
const TYPES_SRC_PATH = __dirname + "/frontend/src/metabase-types";
const TEST_SUPPORT_PATH = __dirname + "/frontend/test/__support__";
const BUILD_PATH = __dirname + "/resources/frontend_client";

// default NODE_ENV to development
const NODE_ENV = process.env["NODE_ENV"] || "development";

// Babel:
const BABEL_CONFIG = {
  cacheDirectory: process.env.BABEL_DISABLE_CACHE ? null : ".babel_cache",
};

const CSS_CONFIG = {
  localIdentName:
    NODE_ENV !== "production"
      ? "[name]__[local]___[hash:base64:5]"
      : "[hash:base64:5]",
  importLoaders: 1,
};

const config = (module.exports = {
  context: SRC_PATH,

  // output a bundle for the app JS and a bundle for styles
  // eventually we should have multiple (single file) entry points for various pieces of the app to enable code splitting
  entry: {
    "app-main": "./app-main.js",
    "app-public": "./app-public.js",
    "app-embed": "./app-embed.js",
    styles: "./css/index.css",
  },

  // output to "dist"
  output: {
    path: BUILD_PATH + "/app/dist",
    // NOTE: the filename on disk won't include "?[chunkhash]" but the URL in index.html generated by HtmlWebpackPlugin will:
    filename: "[name].bundle.js?[hash]",
    publicPath: "app/dist/",
  },

  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: [{ loader: "babel-loader", options: BABEL_CONFIG }],
      },
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules|\.spec\.js/,
        use: [
          {
            loader: "eslint-loader",
            options: {
              rulePaths: [__dirname + "/frontend/lint/eslint-rules"],
            },
          },
        ],
      },
      {
        test: /\.(eot|woff2?|ttf|svg|png)$/,
        use: [{ loader: "file-loader" }],
      },
      {
        test: /\.css$/,
        use: ExtractTextPlugin.extract({
          fallback: "style-loader",
          use: [
            { loader: "css-loader", options: CSS_CONFIG },
            { loader: "postcss-loader" },
          ],
          publicPath: "./",
        }),
      },
    ],
  },
  resolve: {
    extensions: [".webpack.js", ".web.js", ".js", ".jsx", ".css", ".svg"],
    alias: {
      assets: ASSETS_PATH,
      fonts: FONTS_PATH,
      metabase: SRC_PATH,
      "metabase-lib": LIB_SRC_PATH,
      "metabase-types": TYPES_SRC_PATH,
      __support__: TEST_SUPPORT_PATH,
      style: SRC_PATH + "/css/core/index",
      ace: __dirname + "/node_modules/ace-builds/src-min-noconflict",
      // NOTE @kdoh - 7/24/18
      // icepick 2.x is es6 by defalt, to maintain backwards compatability
      // with ie11 point to the minified version
      icepick: __dirname + "/node_modules/icepick/icepick.min",
    },
  },

  plugins: [
    new webpack.optimize.CommonsChunkPlugin({
      name: "vendor",
      minChunks(module) {
        return module.context && module.context.indexOf("node_modules") >= 0;
      },
    }),
    new UnusedFilesWebpackPlugin({
      globOptions: {
        ignore: [
          "**/types.js",
          "**/types/*.js",
          "**/*.spec.*",
          "**/__support__/*.js",
          "**/__mocks__/*.js*",
          "internal/lib/components-node.js",
          "**/noop.js",
        ],
      },
    }),
    // Extracts initial CSS into a standard stylesheet that can be loaded in parallel with JavaScript
    // NOTE: the filename on disk won't include "?[chunkhash]" but the URL in index.html generated by HtmlWebpackPlugin will:
    new ExtractTextPlugin({
      filename: "[name].bundle.css?[contenthash]",
      allChunks: true,
    }),
    new HtmlWebpackPlugin({
      filename: "../../index.html",
      chunksSortMode: "manual",
      chunks: ["vendor", "styles", "app-main"],
      template: __dirname + "/resources/frontend_client/index_template.html",
      inject: "head",
      alwaysWriteToDisk: true,
    }),
    new HtmlWebpackPlugin({
      filename: "../../public.html",
      chunksSortMode: "manual",
      chunks: ["vendor", "styles", "app-public"],
      template: __dirname + "/resources/frontend_client/index_template.html",
      inject: "head",
      alwaysWriteToDisk: true,
    }),
    new HtmlWebpackPlugin({
      filename: "../../embed.html",
      chunksSortMode: "manual",
      chunks: ["vendor", "styles", "app-embed"],
      template: __dirname + "/resources/frontend_client/index_template.html",
      inject: "head",
      alwaysWriteToDisk: true,
    }),
    new HtmlWebpackHarddiskPlugin({
      outputPath: __dirname + "/resources/frontend_client/app/dist",
    }),
    new webpack.DefinePlugin({
      "process.env": {
        NODE_ENV: JSON.stringify(NODE_ENV),
      },
    }),
    new BannerWebpackPlugin({
      chunks: {
        "app-main": {
          beforeContent:
            "/*\n* This file is subject to the terms and conditions defined in\n * file 'LICENSE.txt', which is part of this source code package.\n */\n",
        },
        "app-public": {
          beforeContent:
            "/*\n* This file is subject to the terms and conditions defined in\n * file 'LICENSE.txt', which is part of this source code package.\n */\n",
        },
        "app-embed": {
          beforeContent:
            "/*\n* This file is subject to the terms and conditions defined in\n * file 'LICENSE-EMBEDDING.txt', which is part of this source code package.\n */\n",
        },
      },
    }),
  ],
});

if (NODE_ENV === "hot") {
  // suffixing with ".hot" allows us to run both `yarn run build-hot` and `yarn run test` or `yarn run test-watch` simultaneously
  config.output.filename = "[name].hot.bundle.js?[hash]";

  // point the publicPath (inlined in index.html by HtmlWebpackPlugin) to the hot-reloading server
  config.output.publicPath =
    "http://localhost:8080/" + config.output.publicPath;

  config.module.rules.unshift({
    test: /\.jsx$/,
    // NOTE: our verison of react-hot-loader doesn't play nice with react-dnd's DragLayer, so we exclude files named `*DragLayer.jsx`
    exclude: /node_modules|DragLayer\.jsx$/,
    use: [
      // NOTE Atte Keinänen 10/19/17: We are currently sticking to an old version of react-hot-loader
      // because newer versions would require us to upgrade to react-router v4 and possibly deal with
      // asynchronous route issues as well. See https://github.com/gaearon/react-hot-loader/issues/249
      { loader: "react-hot-loader" },
      { loader: "babel-loader", options: BABEL_CONFIG },
    ],
  });

  // disable ExtractTextPlugin
  config.module.rules[config.module.rules.length - 1].use = [
    { loader: "style-loader" },
    { loader: "css-loader", options: CSS_CONFIG },
    { loader: "postcss-loader" },
  ];

  config.devServer = {
    hot: true,
    inline: true,
    contentBase: "frontend",
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
    // if webpack doesn't reload UI after code change in development
    // watchOptions: {
    //     aggregateTimeout: 300,
    //     poll: 1000
    // }
    // if you want to reduce stats noise
    // stats: 'minimal' // values: none, errors-only, minimal, normal, verbose
  };

  config.plugins.unshift(
    new webpack.NoEmitOnErrorsPlugin(),
    new webpack.NamedModulesPlugin(),
    new webpack.HotModuleReplacementPlugin(),
  );
}

if (NODE_ENV !== "production") {
  // replace minified files with un-minified versions
  for (const name in config.resolve.alias) {
    const minified = config.resolve.alias[name];
    const unminified = minified.replace(/[.-\/]min\b/g, "");
    if (minified !== unminified && fs.existsSync(unminified)) {
      config.resolve.alias[name] = unminified;
    }
  }

  // enable "cheap" source maps in hot or watch mode since re-build speed overhead is < 1 second
  // config.devtool = "cheap-module-source-map";

  // works with breakpoints and makes stacktraces readable
  config.devtool = "inline-module-source-map";

  // helps with source maps
  config.output.devtoolModuleFilenameTemplate = "[absolute-resource-path]";
  config.output.pathinfo = true;

  config.plugins.push(
    new WebpackNotifierPlugin({
      excludeWarnings: true,
      skipFirstNotification: true,
    }),
  );
} else {
  config.plugins.push(new UglifyJSPlugin({ test: /\.jsx?($|\?)/i }));

  config.devtool = "source-map";
}
