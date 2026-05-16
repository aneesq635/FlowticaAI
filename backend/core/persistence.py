from typing import Any, Dict, List, Optional, Union, Tuple
from datetime import datetime
from langgraph.checkpoint.base import BaseCheckpointSaver, Checkpoint, CheckpointMetadata, CheckpointTuple
from pymongo import MongoClient
import json
import pickle

class MongoCheckpointer(BaseCheckpointSaver):
    """
    A LangGraph checkpointer that persists state to MongoDB.
    """
    def __init__(self, db):
        super().__init__()
        self.db = db
        self.checkpoints = db.langgraph_checkpoints

    def get_tuple(self, config: Dict[str, Any]) -> Optional[CheckpointTuple]:
        """
        Retrieves a checkpoint tuple for a given configuration.
        """
        thread_id = config["configurable"]["thread_id"]
        checkpoint_id = config["configurable"].get("checkpoint_id")

        query = {"thread_id": thread_id}
        if checkpoint_id:
            query["checkpoint_id"] = checkpoint_id
        
        # Get the latest checkpoint for this thread
        doc = self.checkpoints.find_one(query, sort=[("timestamp", -1)])
        
        if not doc:
            return None

        # Deserialize using pickle
        checkpoint = pickle.loads(doc["checkpoint"])
        metadata = pickle.loads(doc["metadata"])
        parent_id = doc.get("parent_id")
        
        return CheckpointTuple(
            config={"configurable": {"thread_id": thread_id, "checkpoint_id": doc["checkpoint_id"]}},
            checkpoint=checkpoint,
            metadata=metadata,
            parent_config={"configurable": {"thread_id": thread_id, "checkpoint_id": parent_id}} if parent_id else None
        )

    def list(self, config: Dict[str, Any], *, before: Optional[Dict[str, Any]] = None, limit: Optional[int] = None) -> Any:
        """
        Lists checkpoints for a given configuration.
        """
        thread_id = config["configurable"]["thread_id"]
        query = {"thread_id": thread_id}
        
        if before:
            # Implement 'before' logic if needed, usually based on timestamp or checkpoint_id
            # For now, we'll just sort by timestamp
            pass

        cursor = self.checkpoints.find(query).sort("timestamp", -1)
        if limit:
            cursor = cursor.limit(limit)

        for doc in cursor:
            checkpoint = pickle.loads(doc["checkpoint"])
            metadata = pickle.loads(doc["metadata"])
            thread_id = doc["thread_id"]
            checkpoint_id = doc["checkpoint_id"]
            parent_id = doc.get("parent_id")

            yield CheckpointTuple(
                config={"configurable": {"thread_id": thread_id, "checkpoint_id": checkpoint_id}},
                checkpoint=checkpoint,
                metadata=metadata,
                parent_config={"configurable": {"thread_id": thread_id, "checkpoint_id": parent_id}} if parent_id else None
            )

    def put_writes(self, config: Dict[str, Any], writes: List[Tuple[str, Any]], task_id: str) -> None:
        """
        Stores intermediate writes for a given configuration and task.
        """
        thread_id = config["configurable"]["thread_id"]
        checkpoint_id = config["configurable"]["checkpoint_id"]
        
        # Serialize writes using pickle
        serialized_writes = pickle.dumps(writes)
        
        doc = {
            "thread_id": thread_id,
            "checkpoint_id": checkpoint_id,
            "task_id": task_id,
            "writes": serialized_writes,
            "timestamp": datetime.utcnow()
        }
        
        # Store in a dedicated 'writes' collection
        self.db.langgraph_writes.insert_one(doc)

    def put(self, config: Dict[str, Any], checkpoint: Checkpoint, metadata: CheckpointMetadata, new_checkpoint_id: str) -> Dict[str, Any]:
        """
        Persists a checkpoint for a given configuration.
        """
        thread_id = config["configurable"]["thread_id"]
        # Use new_checkpoint_id as the unique identifier for this checkpoint
        checkpoint_id = new_checkpoint_id
        
        # Serialize using pickle for binary safety in MongoDB
        serialized_checkpoint = pickle.dumps(checkpoint)
        serialized_metadata = pickle.dumps(metadata)
        
        doc = {
            "thread_id": thread_id,
            "checkpoint_id": checkpoint_id,
            "checkpoint": serialized_checkpoint,
            "metadata": serialized_metadata,
            "parent_id": config["configurable"].get("checkpoint_id"),
            "timestamp": datetime.utcnow()
        }
        
        self.checkpoints.insert_one(doc)
        
        return {
            "configurable": {
                "thread_id": thread_id,
                "checkpoint_id": checkpoint_id
            }
        }
