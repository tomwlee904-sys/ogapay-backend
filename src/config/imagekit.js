'use strict';

const { ImageKit } = require('@imagekit/nodejs');

let client = null;

function getImageKitClient() {
  if (!client) {
    const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

    if (!publicKey || !privateKey || !urlEndpoint) {
      return null;
    }

    client = new ImageKit({ publicKey, privateKey, urlEndpoint });
  }
  return client;
}

function getAuthParameters() {
  const ik = getImageKitClient();
  if (!ik) return null;
  return ik.helper.getAuthenticationParameters();
}

module.exports = { getImageKitClient, getAuthParameters };
