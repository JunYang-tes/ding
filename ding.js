const TIPS = "This means Ding is not running or DingEx may not be installed"
class DingProxy {
  constructor(srpc) {
    this.srpc = srpc
  }
  search(keywards) {
    return this.srpc.call("search", keywards)
  }
  open(id) {
    return this.srpc.call("open", id)
  }
  send(id, message, times = 1) {
    return this.srpc.call("sendMsg", {
      id,
      message
    }, times)
  }
}


module.exports = function (injected) {
  const utils = injected.utils
  const { debug } = injected.logger("ding")
  console.log(debug)
  debug("create ding processors")
  const dingEx = {

    async screenshot() {
      console.log("screen shot")
      let hasCmd = await utils.hasCmd("import")
      hasCmd = hasCmd && await utils.hasCmd("xclip")
      if (!hasCmd) {
        throw new Error("import,xclip are required")
      }

      await utils.exec("import", ["/tmp/tmp.png"])
      await utils.exec("xclip", [
        "-selection",
        "clipboard",
        "-t",
        "image/png",
        "/tmp/tmp.png"
      ])
    }
  }
  return utils.decorate({
    declare() {
      return {
        services: ["twoWayCall"],
        params: {
          twoWayCall: {
            type: "eolwebsocket",
            timeout: 3 * 1000,
            provider: dingEx
          }
        }
      }
    },
    init({ services }) {
      let { twoWayCall } = services
      this.twoWayCall = twoWayCall
      this.ding = new DingProxy(twoWayCall)
    },

    hello() {
      return [{
        title: "Hello from ding processor"
      }]
    },
    open(op, list) {
      return list.map(i => ({
        title: "Open in ding",
        text: i.text,
        value: i.text,
        param: {
          cid: i.param.cid,
          action: "func",
          func: this.ding.open.bind(this.ding),
          args: [i.param.cid]
        }
      }))
    },
    boom(op, list) {
      let cnt = +op.cnt
      let msg = op.msg
      if (!msg || !Number.isInteger(cnt)) {
        return [{
          text: "boom --cnt <integer> --msg <message>"
        }]
      } else {
        return list.map(i => ({
          title: `Send message to ${i.value}`,
          text: msg,
          value: msg,
          param: {
            cid: i.param.cid,
            action: "func",
            func: this.ding.send.bind(this.ding),
            args: [
              i.param.cid, msg, cnt
            ]
          }
        }))
      }
    },
    msg(op, list) {
      let msg = op.strings.join(" ")
      return list.map(i => ({
        title: `Send message to ${i.value}`,
        text: msg,
        value: msg,
        param: {
          cid: i.param.cid,
          action: "func",
          func: this.ding.send.bind(this.ding),
          args: [
            i.param.cid, msg
          ]
        }
      }))
    },
    async search(op) {
      if (op.strings.length) {
        let keywords = op.strings.join(" ")
        return this.open({}, (await this.ding.search(keywords)).map(c => ({
          text: c.name,
          value: c.value,
          param: {
            cid: c.id
          }
        })))
      } else {
        return [{
          title: "Search contacts",
          text: "ding.search <keywords>"
        }]
      }
    }
  }, (self, processor) =>
      async (op, list) => {
        if (self.twoWayCall.ready()) {
          return processor.call(self, op, list)
        } else {
          return [{
            title: "Dingtalk is not ready",
            text: TIPS
          }]
        }
      })
}