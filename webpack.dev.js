const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');
const webpack = require('webpack');

let mainConfig = {
    mode: 'development',
    entry: './src/main/main.ts',
    target: 'electron-main',
    output: {
        filename: 'main.bundle.js',
        path: __dirname + '/dist',
    },
    node: {
        __dirname: false,
        __filename: false,
    },
    resolve: {
        extensions: ['.js', '.json', '.ts'],
    },
    externals: { 'react-native-fs': 'reactNativeFs' },
    module: {
        rules: [
            {
                // All files with a '.ts' or '.tsx' extension will be handled by 'ts-loader'.
                test: /\.(ts)$/,
                exclude: /node_modules/,
                use: {
                    loader: 'ts-loader',
                },
            },
            {
                test: /\.(jpg|png|svg|ico|icns)$/,
                type: 'asset/resource',
                generator: {
                    filename: '[path][name][ext]',
                },
            },
            {
                test: /\.(eot|ttf|woff|woff2)$/,
                type: 'asset/resource',
                generator: {
                    filename: '[path][name][ext]',
                },
            },
        ],
    },
};

let rendererConfig = {
    mode: 'development',
    entry: { renderer: './src/renderer/renderer.tsx' },
    target: 'electron-renderer',
    devtool: 'source-map',
    output: {
        filename: '[name].bundle.js',
        chunkFilename: '[name].chunk.js',
        path: __dirname + '/dist',
    },
    node: {
        __dirname: false,
        __filename: false,
        global: true,
    },
    resolve: {
        extensions: ['.js', '.json', '.ts', '.tsx'],
    },
    externals: { 'react-native-fs': 'reactNativeFs' },
    optimization: {
        splitChunks: {
            chunks: 'all',
            maxInitialRequests: 20,
            cacheGroups: {
                react: {
                    test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
                    name: 'vendor-react',
                    chunks: 'all',
                    priority: 40,
                },
                mui: {
                    test: /[\\/]node_modules[\\/]@mui[\\/]/,
                    name: 'vendor-mui',
                    chunks: 'all',
                    priority: 30,
                },
                codemirror: {
                    test: /[\\/]node_modules[\\/](codemirror|react-codemirror2)[\\/]/,
                    name: 'vendor-codemirror',
                    chunks: 'all',
                    priority: 20,
                },
                vendors: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendor-libs',
                    chunks: 'all',
                    priority: 10,
                },
            },
        },
    },
    module: {
        rules: [
            {
                // All files with a '.ts' or '.tsx' extension will be handled by 'ts-loader'.
                test: /\.(ts|tsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: 'ts-loader',
                },
            },
            {
                test: /\.mjs$/,
                resolve: { fullySpecified: false },
            },
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    { loader: 'css-loader', options: { sourceMap: true } },
                ],
            },
            {
                test: /\.(jpg|png|svg|ico|icns)$/,
                type: 'asset/resource',
                generator: {
                    filename: '[path][name][ext]',
                },
            },
            {
                test: /\.(eot|ttf|woff|woff2)$/,
                type: 'asset/resource',
                generator: {
                    filename: '[path][name][ext]',
                },
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, './src/renderer/index.html'),
        }),
        // Create a global variable at compile time
        new webpack.DefinePlugin({
            __VERSION__: JSON.stringify(require("./package.json").version),
          })
    ],
};

module.exports = [mainConfig, rendererConfig];