import { Block } from 'jsxstyle'
import React, { useState } from 'react'
import { DragHandle } from '@/components/DragHandle'

const MIN_SIZE = 60
const MAX_SIZE = 480
const INITIAL_SIZE = 240

export const Inspector: React.FC = () => {
  const [size, setSize] = useState(INITIAL_SIZE)
  const [initialSize, setInitialSize] = useState(INITIAL_SIZE)

  const handleDrag = (offset: number) => {
    setSize(Math.max(MIN_SIZE, Math.min(MAX_SIZE, initialSize + offset)))
  }

  const handleDragStart = () => {
    setInitialSize(size)
  }

  const handleDragEnd = () => {
    setInitialSize(size)
  }

  return (
    <Block
      gridArea="inspector"
      height={size}
      position="relative"
    >
      <DragHandle
        edge="top"
        onDrag={handleDrag}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      />
    </Block>
  )
}
