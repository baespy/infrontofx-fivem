ESX = exports["es_extended"]:getSharedObject()
local scriptname = GetCurrentResourceName()

FC = {}

FC.PublishStatus = function(data)
    if GetResourceState(Config.General.bridge_resource) ~= "started" then
        return false
    end

    return exports[Config.General.bridge_resource]:publish("status", data)
end
