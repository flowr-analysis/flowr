# Understanding Data Flow Graph (DFG) Node Labels in Flowr

## Overview
The Data Flow Graph (DFG) in Flowr represents the dependencies between different code components. Each node in the DFG contains specific labels that provide information about the operation being performed, the code span, and its relationship with other nodes.

This document clarifies the meaning of these labels and how to interpret them.

## Node Label Structure
Each node in the DFG follows this general format:

```
[NodeType] (NodeID) LineRange ParentNodes
```

### **Breakdown of Components:**
- **NodeType:** Indicates the type of operation. Example: `[RBinaryOp]` for a binary operation.
- **NodeID:** A unique identifier for the node. Example: `(7)`.
- **LineRange:** The span of lines in the source code that the node covers. Example: `2.1-10` (meaning the node spans lines 2.1 to 10).
- **ParentNodes:** The IDs of nodes that this node depends on. Example: `(3,6)` (indicating that this node depends on nodes 3 and 6).

## Example Node Labels and Their Meaning
Below are some example node labels and explanations:

### **Example 1: Binary Operation**
```
[RBinaryOp] (7) 2.1-10 (3,6)
```
- `[RBinaryOp]` → This node represents a binary operation.
- `(7)` → The unique ID for this node.
- `2.1-10` → This operation occurs between lines **2.1 and 10** in the code.
- `(3,6)` → This node is dependent on nodes **3 and 6**.

### **Example 2: Function Call**
```
[RFunctionCall] (12) 4.5-8 (7,10)
```
- `[RFunctionCall]` → Represents a function call.
- `(12)` → Unique ID of the function call node.
- `4.5-8` → The function call spans lines 4.5 to 8.
- `(7,10)` → Depends on nodes **7 and 10**.

## How to Use This Information
- When analyzing a **DFG output**, check **NodeType** first to understand the kind of operation.
- Follow the **ParentNodes** list to understand dependencies between nodes.
- Use **LineRange** to find the relevant section in the source code.

## Future Improvements
If you find inconsistencies in the node labels or need additional documentation, feel free to contribute by improving this document or adding examples.

---

By adding this documentation, users will have a clear reference for interpreting node labels in Flowr’s Data Flow Graph. 🚀

