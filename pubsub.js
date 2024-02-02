import {WsServer} from "@reneos/server"
import EventPub from "./eventpub.js"

let _client, _connected

/**
 * Network pubsub
 */
class PubSub {

	static get Connected() {
		return _connected
	}

	/**
	 * 
	 * @param {*} config : {
	 * 	tokenhead - Header name for the authorization token, by default "x-token"
	 * 	token - auth token
	 * 	idhead - Header name for client ID, default "x-id",
	 * 	id - cleint ID
	 * 
	 * 	url - server url, default "ws://127.0.0.1:11000",
	 * 	reconect - Reconnect (default true),
	 * 	delay - delay seconds defore reconect
	 *}
	 * @returns 
	 */
	static Connect(config) {
		
		return new Promise((resolve) => {
			_client = new WsServer.Client(PubSub.Generate())
			_client.on("message", PubSub.ReadMessage)
			_client.on("connect", () => {
				_connected = true				
				EventPub.Emit("connect", _client.id)
				resolve(true)
			})
			_client.on("error", (m, c) => {
				if(m.code==="ECONNREFUSED")
					return resolve(false)
				EventPub.Emit("error", m, c)
			})
			_client.on("close", r => {
				_connected = false
				EventPub.Emit("close", r)
			})
			const {tokenhead ="x-token",idhead="x-id",token,id,  ...conf} = config
			_client.connect(conf, {
				headers:{
					[tokenhead] : token || '',
					[idhead ]:id || ''
				}
			})
		})
	}

	static Disconnect() {
		if (_client) {
			_client.close()
		}
	}

	/**
	 * On EventPub Publish from local publisher for send to server
	 * @param {*} value 
	 * @param {*} path 
	 * @param {*} eventId 
	 * @param {*} eventDate 
	 * @param {*} source 
	 */
	static SendToRemote(value, path, eventId, eventDate, source) {
		if (source)//if source - this.from server
			return
		try {
			const str = JSON.stringify({ path, data: value, id: eventId, date: eventDate,source: null })
			const result = _client.send(str)
		} catch (error) {
			console.warn(error)
		}
	}

	/**
	 * Handler on recive message from server
	 * @param {*} clientId 
	 * @param {*} msg 
	 */
	static ReadMessage(message) {
		const msg = JSON.parse(message.toString())
		if (_client.id === msg?.source)
			return //only remote
		EventPub.Publish(msg.path, msg.data, msg.id, msg.date, msg.source,msg.group)
	}

	static  Generate(len = 24) {	
		const sym = "ABCDEFGHIKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890";
		let str = ''
		for (let i = 0; i < len; i++)
			str += sym[Math.floor(Math.random() * sym.length)]
		return str
	}
}

export default new Proxy(PubSub, {
	get(target, prop) {
		return target[prop] === undefined ? EventPub[prop] : target[prop]
	}
})