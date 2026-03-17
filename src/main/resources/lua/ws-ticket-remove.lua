local oldTicket = redis.call('GET', KEYS[1])
if not oldTicket then
    return 0
end

redis.call('DEL', KEYS[1])
redis.call('DEL', ARGV[1] .. oldTicket)
redis.call('SREM', KEYS[2], oldTicket)
return 1
