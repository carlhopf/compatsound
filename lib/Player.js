const Log = require('loglevel');
const howler = require('howler');
const tag = 'compatsound/Player';

function isCordova() {
	return typeof window.cordova !== 'undefined';
}

/**
 * Compat player for howlerjs and cordova.
 *
 * Bugs:
 * - if app name has spaces, cordova Media will not play/load (escape spaces?)
 *
 * @param urls {array} Array of _relative_ sound file paths, must put .mp3 at index 0!
 * @param volume {float} Volume of 0 to 1.
 */
var Player = function(opts) {
	this.urls = opts.urls;
	this.sprites = opts.sprites;
	this.cordovaSprites = opts.cordovaSprites;
	this.volume = opts.volume;

	if(this.urls[ 0 ].indexOf('.mp3') === -1) {
		throw new Error('urls[0] is not mp3: ' + this.urls[ 0 ]);
	}

	var fixUri = function(uri) {
		// android wont work with relative uri
		// http://www.raymondcamden.com/2014/06/23/Cordova-Media-API-Example
		var platform = window.device && window.device.platform;

		if(platform && platform.toLowerCase() === 'android') {
			var path = window.location.pathname;
			var prefix = path.substr(0, path.lastIndexOf('/'));
			return prefix + '/' + uri;
		}

		// iOS works fine with relative uri
		return uri;
	}.bind(this);

	// cordova media on wp8 had issues with seekTo, so instead use individual sound files
	if(isCordova() && typeof window.Media !== 'undefined' && this.cordovaSprites) {
		var buffer = {};

		Object.keys(this.cordovaSprites).forEach(function(sprite) {
			var src = fixUri(this.cordovaSprites[ sprite ]);
			Log.info(tag, 'create sprite ' + src);

			buffer[ sprite ] = new Media(
				src,
				function() {
					Log.debug(tag, 'media success: ' + src);
				},
				function(err) {
					Log.error(tag, 'media error: ' + err + ' ' + (err && err.code));
				});
		}, this);

		this._play = function(name) {
			if(!buffer[ name ]) {
				Log.error(tag, 'no sprite: ' + name);
				return;
			}

			buffer[ name ].play();
		};

		this._destroy = function() {
			Object.keys(buffer).forEach(function(sprite) {
				buffer[ sprite ].release();
			}, this);
		};
	}
	// use cordova seekTo for sprite playback
	else if(isCordova() && typeof window.Media !== 'undefined') {
		// http://stackoverflow.com/a/11340675
		// get absolute path to asset directory (strip away index*.html file name)
		// - ios: doesnt work in emulator, but works on device
		// - android: tested & works
		var status = -1;
		var playing = false;
		var src = fixUri(this.urls[ 0 ]);

		Log.debug(tag, 'use cordova, path ' + src);

		this._media = new Media(
			src,
			function() {
				Log.debug(tag, 'media play success');
			}.bind(this),
			function(err) {
				Log.debug(tag, 'media play error ' + err.code + ', ' + err.message);
			}.bind(this),
			function(mediaStatus) {
				Log.debug(tag, 'media play status ' + mediaStatus);
				status = mediaStatus;
			}.bind(this));

		if(this._media.setVolume) {
			this._media.setVolume(this.volume);
		}

		this._play = function(name) {
			Log.debug(tag, 'media play: ' + name);

			if(playing || status === Media.MEDIA_STARTING || status === Media.MEDIA_RUNNING) {
				Log.debug(tag, 'media play, but already starting/running');
				return;
			}

			clearTimeout(this._toPause);
			var sprite = this.sprites[ name ];

			this._media.play();
			this._media.seekTo(sprite[ 0 ]);

			this._toPause = setTimeout(function() {
				Log.debug(tag, 'media pause: ' + name);
				playing = false;
				this._media.pause();
				this._media.seekTo(0);
			}.bind(this), sprite[ 1 ]);
		};

		this._destroy = function() {
			this._media.release();
		};
	}
	// howlerjs
	else {
		Log.debug(tag, 'use howler');

		this._media = new howler.Howl({
			src: this.urls,
			sprite: this.sprites,
			volume: this.volume,
			onloaderror: function (err) {
				Log.warn(tag, 'howler load error', err);
			},
		});

		this._play = function(name) {
			this._media.play(name);
		};

		this._destroy = function() {
			this._media.unload();
		};
	}
};

Player.prototype._play = function() {
	Log.warn(tag, '_play not specified');
};

Player.prototype._destroy = function() {
	Log.warn(tag, '_destroy not specified');
};

/**
 * Play a sprite, defined by it's name.
 */
Player.prototype.playSprite = function(name) {
	this._play(name);
};

Player.prototype.destroy = function() {
	this._destroy();
};


module.exports = Player;
