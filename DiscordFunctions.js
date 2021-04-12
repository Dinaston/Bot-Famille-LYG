module.exports.getDefaultChannel = function(guild) {
    var channel;
    guild.channels.cache.array().forEach(function(c) {
        if (c.type !== "voice" && c.type !== "category") {
            if (!channel) {
                channel = c;
            } else if (channel.position > c.position) {
                channel = c;
            }
        }
    });
    return channel;
};
