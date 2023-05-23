const NativeModule = require('@proceed/native-module');
const mqtt = require('async-mqtt');

class NativeMQTT extends NativeModule {
  constructor() {
    super();
    this.commands = ['messaging_publish', 'messaging_connect', 'messaging_disconnect'];

    this.connections = {};
  }

  async executeCommand(command, args) {
    if (command === 'messaging_publish') {
      return await this.publish(...args);
    }
    if (command === 'messaging_connect') {
      return await this.connect(...args, true);
    }
    if (command === 'messaging_disconnect') {
      return await this.disconnect(...args, true);
    }
    return undefined;
  }

  /**
   * A helper function that ensures that we have necessary information in the correct places
   *
   * url: We need the log-in information in the url to differentiate between different sessions on the same mqtt broker
   * connectionOptions: we need the log-in information in the connectOptions for the mqtt library to be able to use it
   *
   * Log-in information might come from two different places (will be used in the following order):
   *
   * 1. user provided info in the url
   * 2. info in the connectionOptions
   *    2a. user provides info in the connectionOptions object
   *    2b. default info from the engine config (universal part will write this into the connectionOptions if there is no user provided config info)
   *
   * Options to define log in information:
   *
   * 1. no url info/no user config/no engine config => no log-in info                                                                    => log-in without any authentification
   * 2. no url info/no user config/engine config    => universal part will autocomplete with engine config                               => log-in with engine config values
   * 3. no url info/user config   /no engine config => no universal autocompletion; completion of the url in this function               => log-in with user config values
   * 4. no url info/user config   /engine config    => no universal autocompletion; completion of the url in this function               => log-in with user config values
   * 5. url info   /no user config/no engine config => no universal autocompletion; completion of the connectionOptions in this function => log-in with url info
   * 6. url info   /no user config/engine config    => universal part will autocomplete with engine config; this functions overrides     => log-in with url info
   * 7. url info   /user config   /no engine config => no universal autocompletion; url info will be used before user config info        => log-in with url info
   * 8. url info   /user config   /engine config    => no universal autocompletion; url info will be used before user config info        => log-in with url info
   *
   * @param {String} url
   * @param {Object} connectionOptions the current connection option; BEWARE: this might be changed if there is log-in information in the url
   * @returns {String} the url with log-in information
   */
  _extendUrlAndConnectionOptions(url, connectionOptions) {
    url = new URL(url);
    // the url might contain login information => get that information from the url and put it into the connection options
    // (this will override the auth information in the connectionOptions if there is auth data in the url)
    connectionOptions.username = url.username || connectionOptions.username;
    connectionOptions.password = url.password || connectionOptions.password;
    // either keep the auth info in the url or add the info from the options object if there is none in the url
    // (will be used to identify a connection by user if there are mutliple connections to the same address)
    url.username = url.username || connectionOptions.username;
    url.password = url.password || connectionOptions.password;
    return url.toString();
  }

  /**
   * Returns a connection to the mqtt broker with the given address using the given log-in information
   *
   * Creates a new connection if no connection is open for the combination of address and log-in information
   *
   * @param {String} url
   * @param {String} connectionOptions
   * @param {Boolean} keepOpen if the connection can be automatically cleaned up after a publish or if it should be kept
   * @returns {Object} the connection
   */
  async connect(url, connectionOptions, keepOpen) {
    connectionOptions = JSON.parse(connectionOptions || '{}');
    url = this._extendUrlAndConnectionOptions(url, connectionOptions);

    // check if there is already a connection for the given url
    // extendUrlAndConnectionOptions(...) will put the user auth into the url so we can differentiate between connections with different auth data to the same mqtt broker
    if (this.connections[url]) {
      return this.connections[url];
    }

    // if the connectionOptions contains a will message that is a stringified JSON (the mqtt library expect the payload to be a string) the JSON.parse at the start of the function will have transformed it to an object
    if (connectionOptions.will && typeof connectionOptions.will.payload === 'object') {
      connectionOptions.will.payload = JSON.stringify(connectionOptions.will.payload);
    }

    // connect to the mqtt server using optional parameters like username and password
    const client = await mqtt.connectAsync(url, {
      clean: true, // don't reuse an earlier connection
      ...connectionOptions,
    });

    // set this flag to ensure that the connection is not automatically cleaned up after a publish
    client.keepOpen = keepOpen;

    // store the client so we don't try to reconnect for future publish or subscribe calls
    this.connections[url] = client;

    return client;
  }

  /**
   * Will close a connection to an mqtt broker if it exists
   *
   * @param {String} url
   * @param {String} connectionOptions should contain the log-in information that the connection was opened with to identify the correct connection
   * @param {Boolean} forceClose will close a connection even if it is set to be kept open
   */
  async disconnect(url, connectionOptions, forceClose) {
    connectionOptions = JSON.parse(connectionOptions || '{}');
    url = this._extendUrlAndConnectionOptions(url, connectionOptions);

    // get the connection that was stored for this address and login info combination
    const client = this.connections[url];

    if (client && (forceClose || !client.keepOpen)) {
      // close the connection and remove it
      await client.end();
      delete this.connections[url];
    }
  }

  async publish(url, topic, message, messageOptions, connectionOptions) {
    const client = await this.connect(url, connectionOptions);

    messageOptions = JSON.parse(messageOptions || '{}');

    /**
     * send the message with optional parameters like qos
     *
     * qos 0: The message is sent only once and there is no checking if it actually arrived
     * qos 1: The message is sent until an acknowledgement is received; it might arrive multiple times
     * qos 2: The message is sent in a way that ensures that it arrives exactly once
     */
    await client.publish(topic, message, { qos: 2, ...messageOptions });

    await this.disconnect(url, connectionOptions);
  }
}

module.exports = NativeMQTT;