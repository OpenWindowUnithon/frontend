export {
	acceptCall,
	createCall,
	createOutgoingCall,
	disconnectCall,
	endCall,
	getCallStatus,
	getIncomingCall,
	getRecentCalls,
	joinCall,
	registerPhone,
	rejectCall,
	sendHeartbeat,
	terminateCall,
} from "./api/call-api";
export { sendChatText } from "./api/call-chat";
export type { AiVoice, AiVoiceSpeed, CallPreferences } from "./model/call-preferences";
export {
	DEFAULT_CALL_PREFERENCES,
	getCallPreferences,
	setCallPreferences,
} from "./model/call-preferences";
export { getDeviceKey, getMyPhone, setMyPhone } from "./model/device-identity";
export {
	type CallMode,
	type CallParams,
	type CallRole,
	type CallStatus,
	type CommunicationMode,
	callModeSchema,
	callParamsSchema,
	callRoleSchema,
	callStatusSchema,
	communicationModeSchema,
	type IncomingCall,
	incomingCallSchema,
	type JoinResult,
	joinResultSchema,
	type OutgoingCall,
	outgoingCallSchema,
	phoneRegistrationSchema,
	type RecentCall,
	recentCallSchema,
	type StatusResult,
	statusResultSchema,
} from "./model/types";
