import copy
import uuid
from abc import abstractmethod, ABC
from typing import Any, Dict, List

from bisheng.workflow.callback.base_callback import BaseCallback
from bisheng.workflow.callback.event import NodeStartData, NodeEndData
from bisheng.workflow.common.node import BaseNodeData
from bisheng.workflow.edges.edges import EdgeBase
from bisheng.workflow.graph.graph_state import GraphState


class BaseNode(ABC):

    def __init__(self, node_data: BaseNodeData, workflow_id: str, graph_state: GraphState,
                 target_edges: List[EdgeBase], max_steps: int, callback: BaseCallback, **kwargs: Any):
        self.id = node_data.id
        self.type = node_data.type
        self.name = node_data.name
        self.description = node_data.description
        self.target_edges = target_edges

        # 全局状态管理
        self.workflow_id = workflow_id
        self.graph_state = graph_state

        # 节点全部的数据
        self.node_data = node_data

        # 存储节点所需的参数 处理后的可直接用的参数
        self.node_params = {}

        # 用来判断是否运行超过最大次数
        self.current_step = 0
        self.max_steps = max_steps

        # 回调，用来处理节点执行过程中的各种事件
        self.callback_manager = callback
        # 是否发送节点开始和结束的事件
        self.node_start_end_event = True

        # 存储临时数据的 milvus 集合名 和 es 集合名 用workflow_id作为分区键
        self.tmp_collection_name = "tmp_workflow_data"

        self.init_data()

    def init_data(self):
        """ 节点有特殊数据需要处理的，可以继承此函数处理 """
        if not self.node_data.group_params:
            return

        for one in self.node_data.group_params:
            for param_info in one.params:
                self.node_params[param_info.key] = copy.deepcopy(param_info.value)

    @abstractmethod
    def _run(self) -> Dict[str, Any]:
        """
        Run node 返回的结果会存储到全局的变量管理里，可以被其他节点使用
        :return:
        """
        raise NotImplementedError

    def get_input_schema(self) -> Any:
        """ 返回用户需要输入的表单描述信息 """
        return None

    def handle_input(self, user_input: dict) -> Any:
        # 将用户输入的数据更新到节点数里
        self.node_params.update(user_input)

    def route_node(self, state: dict) -> str:
        """
        对应的langgraph的condition_edge的function，只有特殊节点需要
        :return: 节点id
        """
        raise NotImplementedError

    def run(self, state: dict) -> Any:
        """
        Run node entry
        :return:
        """
        if self.current_step >= self.max_steps:
            raise Exception(f"node {self.name} exceeded more than max steps")

        exec_id = uuid.uuid4().hex
        start_end_event = self.node_start_end_event
        if start_end_event:
            self.callback_manager.on_node_start(data=NodeStartData(unique_id=exec_id, node_id=self.id, name=self.name))

        reason = None
        try:
            result = self._run()
            # 把节点输出存储到全局变量中
            if result:
                for key, value in result.items():
                    self.graph_state.set_variable(self.id, key, value)
            self.current_step += 1
        except Exception as e:
            reason = str(e)
            raise e
        finally:
            self.callback_manager.on_node_end(
                data=NodeEndData(unique_id=exec_id, node_id=self.id, name=self.name, reason=reason))
        return state