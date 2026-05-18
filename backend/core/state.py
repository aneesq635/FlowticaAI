from typing import Annotated, List, Dict, Any, TypedDict, Union, Optional
from langchain_core.messages import BaseMessage
import operator

def merge_dicts(old: Dict[str, Any], new: Dict[str, Any]) -> Dict[str, Any]:
    """Reducer for merging dictionaries instead of overwriting."""
    return {**old, **new}

def replace_if_new(old: Dict[str, Any], new: Dict[str, Any]) -> Dict[str, Any]:
    """Reducer that REPLACES old value when new is non-empty, or resets to {} when new is empty.
    Used for intent so it's always fresh each turn."""
    if new:
        return new
    return {}

def replace_list_if_new(old: List[Any], new: List[Any]) -> List[Any]:
    """Reducer for shortlisted_providers: replace when new results arrive, keep old when empty.
    Prevents duplicate accumulation while preserving providers for selection turns."""
    if new:  # New search results came in → replace entirely
        return new
    return old  # No new results → keep existing (for provider_selection turns)

class AgentState(TypedDict):
    # IDENTITY
    conversation_id: str
    user_id: str
    
    # CORE REDUCERS (Append instead of overwrite)
    messages: Annotated[List[BaseMessage], operator.add]
    execution_logs: Annotated[List[Dict[str, Any]], operator.add]
    reasoning_traces: Annotated[List[Dict[str, Any]], operator.add]
    shortlisted_providers: Annotated[List[Dict[str, Any]], replace_list_if_new]
    
    # PIPELINE DATA (passed between agents within a turn)
    provider_candidates: List[Dict[str, Any]]   # KnowledgeAgent → MatchingAgent
    service_request: Annotated[Dict[str, Any], merge_dicts]  # ExtractionAgent → KnowledgeAgent
    
    # RETRIEVAL ENGINE FIELDS
    last_search_query: str
    retrieval_confidence: str
    retrieval_debug: Annotated[Dict[str, Any], merge_dicts]
    last_search_results: Annotated[List[Dict[str, Any]], replace_list_if_new]
    
    # PRODUCTION PATCHABLE FIELDS (Merged instead of overwritten)
    workflow_stage: str
    conversation_stage: str
    
    intent: Annotated[Dict[str, Any], replace_if_new]
    entities: Annotated[Dict[str, Any], merge_dicts]
    
    # MEMORY & PINNED KEYS
    selected_provider: Annotated[Dict[str, Any], merge_dicts]
    booking_context: Annotated[Dict[str, Any], merge_dicts]
    booking_details: Annotated[Dict[str, Any], merge_dicts]
    
    # AGENT-SPECIFIC ISOLATED STATES
    agent_states: Annotated[Dict[str, Any], merge_dicts]
    
    # OUTPUTS (The actual response shown to user)
    frontier_response: str
    
    # STATUS
    active_agent: str
    next_agent: str
    iteration_count: int
    is_complete: bool
    errors: Annotated[List[str], operator.add]
    metadata: Annotated[Dict[str, Any], merge_dicts]
    
    # REQUEST & NEGOTIATION TRACKING
    active_request_id: str
    active_request: Annotated[Dict[str, Any], merge_dicts]
    negotiation_status: str
    selected_service: Annotated[Dict[str, Any], merge_dicts]
    request_creation_success: bool
    request_creation_error: str
    latest_request_status: str
    negotiation_stage: str
    pending_provider_id: str
    latest_offer: Annotated[Dict[str, Any], merge_dicts]
    last_provider_response: str
    request_status: str
    request_id: str
    request_data: Annotated[Dict[str, Any], merge_dicts]
    
    # LOOP SAFETY & RESUME TRACKING
    turn_routed_agents: List[str]
    
    # PROTECTED STATE NAMESPACES
    retrieval: Annotated[Dict[str, Any], merge_dicts]
    negotiation: Annotated[Dict[str, Any], merge_dicts]
    booking: Annotated[Dict[str, Any], merge_dicts]
    notifications: Annotated[Dict[str, Any], merge_dicts]

