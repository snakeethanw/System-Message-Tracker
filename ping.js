module.exports = {
  name: "pingprefix",

  async handle(message, client) {
    // Only respond to prefix commands starting with ;
    if (!message.content.startsWith(";")) return;

    const args = message.content.slice(1).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    if (command === "ping") {
      const sent = await message.reply("Pinging...");
      const latency = sent.createdTimestamp - message.createdTimestamp;

      await sent.edit(`Pong! Latency: **${latency}ms**`);
    }
  }
};
