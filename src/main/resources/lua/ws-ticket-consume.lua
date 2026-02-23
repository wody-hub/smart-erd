local json = redis.call('GET', KEYS[1])
if not json then
    return nil
end

redis.call('DEL', KEYS[1])

local data = cjson.decode(json)
local userSetKey = ARGV[2] .. data['loginId']
local diagramKey = ARGV[3] .. data['loginId'] .. ':' .. tostring(data['diagramId'])

redis.call('SREM', userSetKey, ARGV[1])
redis.call('DEL', diagramKey)

return json
