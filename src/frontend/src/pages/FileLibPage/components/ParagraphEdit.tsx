import FileView from "@/components/bs-comp/FileView";
import { LoadIcon } from "@/components/bs-icons";
import { Button } from "@/components/bs-ui/button";
import { useToast } from "@/components/bs-ui/toast/use-toast";
import { getFilePathApi, getKnowledgeChunkApi, updateChunkApi, updatePreviewChunkApi } from "@/controllers/API";
import { captureAndAlertRequestErrorHoc } from "@/controllers/request";
import { Crosshair2Icon, InfoCircledIcon } from "@radix-ui/react-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from "react-router-dom";
import Markdown from './Markdown';

const ParagraphEdit = ({ chunks = null, isUns = true, filePath = '', fileId, chunkId, onClose }) => {
    const { id } = useParams();
    const [value, setValue] = useState('');
    const [data, setData] = useState([])

    const [fileUrl, setFileUrl] = useState('')
    useEffect(() => {
        chunks ? setFileUrl(filePath) : getFilePathApi(fileId).then(setFileUrl)
    }, [fileId, filePath, chunks])

    const [fileName, setFileName] = useState('')
    const initData = (res) => {
        let labelsData = []
        let value = ''
        res.data.forEach(chunk => {
            const { bbox, chunk_index } = chunk.metadata
            const labels = JSON.parse(bbox).chunk_bboxes

            const active = chunk_index === chunkId
            const resData = labels.map(label => {
                return {
                    page: label.page, label: label.bbox, active, txt: chunk.text
                }
            })

            labelsData = [...labelsData, ...resData]

            if (active) {
                value = chunk.text
            }
        })
        setFileName(res.data[0].metadata.source)
        setData(labelsData)
        setValue(value)
    }
    useEffect(() => {
        chunks ? initData({ data: chunks }) : getKnowledgeChunkApi({ knowledge_id: id, file_ids: [fileId] }).then(initData)
    }, [])

    const markDownRef = useRef(null)
    const { leftPanelWidth, handleMouseDown } = useDragSize(false)
    const [labelChange, setLabelChange] = useState(false)
    const { message } = useToast()

    const [loading, setLoading] = useState(false)
    const handleSave = async () => {
        const _value = markDownRef.current.getValue().trim()
        setValue(_value)
        if (!_value) return

        setLoading(true)
        await captureAndAlertRequestErrorHoc(chunks ? updatePreviewChunkApi({
            knowledge_id: Number(id), file_path: filePath, chunk_index: chunkId, text: _value
        }) : updateChunkApi({
            knowledge_id: Number(id), file_id: fileId, chunk_index: chunkId, text: _value
        }).then(res => {
            message({ variant: 'success', description: '修改成功' })
            onClose()
        }))
        setLoading(false)
    }

    const labels = useMemo(() => {
        return data.reduce((acc, item) => {
            if (!acc[item.page]) {
                acc[item.page] = [];
            }
            acc[item.page].push({ id: item.txt, ...item });

            return acc;
        }, {});
    }, [data]);

    const handleSelectLabels = (lbs) => {
        let arr = data
        lbs.forEach((item) => {
            arr = arr.map(el => el.txt === item.id ? { ...el, active: item.active } : el)
        })
        setData(arr)
        console.log('arr :>> ', lbs, arr);

        setLabelChange(true)
    }

    const handleOvergap = () => {
        setLabelChange(false)
        const res = data.filter(el => el.active)
        const _value = res[0]?.txt || ''
        setValue(_value)
        markDownRef.current.setValue(_value) // fouceupdate
    }

    const [random, setRandom] = useState(0)
    const postion = useMemo(() => {
        const target = data.find(el => el.active)
        return target ? [target.page, target.label[1] + random] : null
    }, [random])

    return (
        <div className="flex px-4 py-2 select-none">
            <div className="relative" style={{ width: leftPanelWidth }}>
                <div className="flex justify-between h-10 items-center mb-2">
                    <span>{fileName}</span>
                    <span># {chunkId + 1}</span>
                </div>
                <Markdown ref={markDownRef} value={value} />
                {!value && <p className="absolute left-0 text-red-500 text-xs mt-2">输入内容不可为空</p>}
                <div className="flex justify-end gap-4">
                    <Button className="px-6" variant="outline" onClick={onClose}>取消</Button>
                    <Button className="px-6" disabled={loading} onClick={handleSave}><LoadIcon className={`mr-1 ${loading ? '' : 'hidden'}`} />保存</Button>
                </div>
            </div>
            {isUns && <>
                <div className="h-full p-2">
                    <div
                        className="h-full w-1 border cursor-ew-resize"
                        onMouseDown={handleMouseDown}
                    ></div>
                </div>
                <div className="flex-1">
                    <div className="flex items-center relative h-10 mb-2 text-sm">
                        <div className={`${labelChange ? '' : 'hidden'} flex items-center`}>
                            <InfoCircledIcon className='mr-1' />
                            <span>检测到分段范围调整,</span>
                            <span className="text-primary cursor-pointer" onClick={handleOvergap}>覆盖分段内容</span>
                        </div>
                    </div>
                    <div className="bg-gray-100 relative">
                        {value && Object.keys(labels).length && <Button className="absolute top-2 right-2 z-10" variant="outline" onClick={() => setRandom(Math.random() / 10000)}><Crosshair2Icon className="mr-1" />回到定位</Button>}
                        <div className="h-[calc(100vh-72px)]">
                            {fileUrl && <FileView select fileUrl={fileUrl} labels={labels} scrollTo={postion} onSelectLabel={handleSelectLabels} />}
                        </div>
                    </div>
                </div>
            </>}
        </div>
    );
};

const useDragSize = (full) => {
    const [leftPanelWidth, setLeftPanelWidth] = useState(full ? '100%' : window.innerWidth * 0.4);
    const [isDragging, setIsDragging] = useState(false);

    const handleMouseDown = useCallback(() => {
        setIsDragging(true);
    }, []);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleMouseMove = useCallback(
        (e) => {
            if (isDragging) {
                const newWidth = e.clientX - 24;
                if (newWidth >= 320 && newWidth <= window.innerWidth * 0.7) {
                    setLeftPanelWidth(newWidth);
                }
            }
        },
        [isDragging]
    );

    React.useEffect(() => {
        if (full) return
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [full, isDragging, handleMouseMove, handleMouseUp]);

    return { leftPanelWidth, handleMouseDown };
}

export default ParagraphEdit;