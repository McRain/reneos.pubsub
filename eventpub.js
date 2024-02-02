import { EventEmitter } from 'events'
const _subscriptions = {}
const _managers = {}

let _events = {};
const _subs = (event, once, handler) => {
	if (_events[event] == null)
		_events[event] = [];
	_events[event].push({ 'handler': handler, "once": once });
}

const _emmiter = new EventEmitter()

/**
 * Represents methods for subscribing and posting events to channels
 */
class EventPub {

	static Clean() {
		_events = {}
		Object.keys(_subscriptions).forEach(k => {
			delete _subscriptions[k]
		})
		Object.keys(_managers).forEach(k => {
			delete _managers[k]
		})
	}

	//#region PubSub

	/**
	 * Subscribes a function to a channel
	 * @param {String} path 
	 * @param {Function} handler
	 * @param {String} key optional - unique subscription key
	 * @param {String} networkId
	 */
	static Subscribe(path, handler, key, netId) {
		let container = _managers
		const k = key || EventPub.Generate()
		if (path.length > 0) {//empty path only for managers
			container = _subscriptions
			const paths = path.split('.')
			for (let i = 0; i < paths.length; i++) {
				const p = paths[i]
				if (!container[p])
					container[p] = {}
				container = container[p]
			}
		}
		container[k]={handler,id: netId}
		EventPub.Emit("subscribe", path, k)
		return k
	}

	static Sub(...args) {
		EventPub.Subscribe.apply(null, args)
	}

	/**
	 * Unsubscribes from the channel by the specified key
	 * @param {String} path 
	 * @param {String} key 
	 */
	static Unsubscribe(key) {
		const f = (cont) => {
			if (cont[key]) {
				delete cont[key]
				return true
			}
			const values = Array.from(Object.values(cont))
			for (let i = 0; i < values.length; i++) {
				const val = values[i]

				if (val && Object.keys(val).length > 0)
					if (f(val))
						return true
			}
			return false
		}
		if (f(_subscriptions)) {
			EventPub.Emit("unsubscribe", key)
		}
		else if (_managers[key])
			delete _managers[key]
	}

	/**
	 * Publication of the event in the channel. 
	 * The event will be received by subscribers including subscribed for part of the channel name
	 * @param {String,Array} path Separated Channel "." or array
	 * @param {Object} data Payload 
	 * @param {String} eventId Unique identifier (network)
	 * @param {Number} eventDate timestamp (network)
	 * @param {String} source Source (Network)
	 */
	static Publish(path, data, eventId, eventDate, source,group) {
		const paths = Array.isArray(path) ? path : path.split('.')
		if (!eventId) {
			eventId = EventPub.Generate()
			eventDate = Date.now()
		}
		for(const [k, v] of Object.entries(_managers)){
			v.handler(data, path, eventId, eventDate, source,group)
		}
		let root = _subscriptions
		const history = []
		for (let i = 0; i < paths.length; i++) {
			const currPath = paths[i]			
			root = root[currPath] || root['*']
			if (!root)
				break
			for (const [k, v] of Object.entries(root)) {
				//Finding a subscription method
				if (v.handler) {
					//If an online id is set (undefined if local)
					if (v.id) {
						//Avoid re-sending
						if (history.includes(v.id))
							return
						history.push(v.id)
					}
					//Call subscribs
					v.handler(data, path, eventId, eventDate, source,group)
				}
			}
		}
	}

	/**
	 * Publication of the event in the channel. 
	 * The event will be received by subscribers including subscribed for part of the channel name
	 * @param {String,Array} path Separated Channel "." or array
	 * @param {Object} data Payload 
	 * @param {String} eventId Unique identifier (network)
	 * @param {Number} eventDate timestamp (network)
	 * @param {String} source Source (Network)
	 */
	static Pub(path, data, eventId, eventDate, source) {
		return EventPub.Publish(path, data, eventId, eventDate, source)
	}

	//#endregion

	static Generate(cnt = 24) {
		const sym = "abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIKLMNOPQRSTUVWXYZ";
		let str = "";
		for (let i = 0; i < cnt; i++)
			str += sym[Math.floor(Math.random() * sym.length)];
		return str;
	}

	//#region Events
	static on(event, handler) {
		_emmiter.on(event, handler)
	}
	static once(event, handler) {
		_emmiter.once(event, handler)
	}
	static off(event, handler) {
		_emmiter.off(event, handler)
	}


	static On(event, handler) {
		_subs(event, false, handler);
	}
	static Once(event, handler) {
		_subs(event, true, handler);
	}
	static Off(event, handler) {
		const evt = _events[event];
		if (!evt)
			return;
		const l = evt.length;
		for (let i = l - 1; i >= 0; i--) {
			if (evt[i].handler === handler)
				evt.splice(i, 1);
		}
		if (evt.length === 0)
			delete _events[event];
	}
	static Emit(event, ...args) {
		_emmiter.emit.apply(_emmiter, arguments)
		const evs = _events[event];
		if (evs == null) return;
		const l = evs.length;
		for (let i = l - 1; i >= 0; i--) {
			const ev = evs[i];
			ev.handler.apply(null, args);
			if (!ev.once)
				continue;
			evs.splice(i, 1);
		}
	}
	//#endregion
}

export default EventPub