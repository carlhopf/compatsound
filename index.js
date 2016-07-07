const Player = require('./lib/Player');

exports.createPlayer = function (options) {
	return new Player(options);
};
