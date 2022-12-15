import { ConsoleEvent, LogLevel, StackEntry } from '@repro/domain'
import { Block, Grid, InlineBlock, Row } from 'jsxstyle'
import { AlertCircle, AlertTriangle } from 'lucide-react'
import React from 'react'
import { colors } from '~/config/theme'
import { formatDate } from '~/utils/date'
import { PartRenderer } from './PartRenderer'

const bgColors = {
  [LogLevel.Error]: colors.rose['100'],
  [LogLevel.Info]: colors.white,
  [LogLevel.Warning]: colors.amber['50'],
  [LogLevel.Verbose]: colors.white,
}

const textColors = {
  [LogLevel.Error]: colors.rose['700'],
  [LogLevel.Info]: colors.slate['700'],
  [LogLevel.Warning]: colors.amber['700'],
  [LogLevel.Verbose]: colors.slate['700'],
}

const icons = {
  [LogLevel.Error]: <AlertTriangle size={16} color={colors.rose['700']} />,
  [LogLevel.Info]: <AlertCircle size={16} color={colors.blue['700']} />,
  [LogLevel.Warning]: <AlertTriangle size={16} color={colors.amber['700']} />,
  [LogLevel.Verbose]: <AlertCircle size={16} color={colors.slate['500']} />,
}

interface Props {
  event: ConsoleEvent
}

export const ConsoleRow: React.FC<Props> = ({
  event: {
    time,
    data: { level, parts, stack },
  },
}) => (
  <Grid
    gridTemplateColumns="auto auto 1fr auto"
    columnGap={10}
    rowGap={10}
    paddingV={5}
    paddingH={15}
    fontSize={13}
    color={textColors[level]}
    backgroundColor={bgColors[level]}
    borderColor={colors.slate['100']}
    borderStyle="solid"
    borderWidth="4px 0 0"
  >
    <Block color={colors.slate['500']} lineHeight={1.25}>
      {formatDate(time, 'millis')}
    </Block>

    <Block>{icons[level]}</Block>

    <Row flexWrap="wrap" gap={10}>
      {parts.map((part, j) => {
        return <PartRenderer part={part} key={j} />
      })}
    </Row>

    {stack[0] ? <StackReference entry={stack[0]} /> : <Block />}
  </Grid>
)

interface StackReferenceProps {
  entry: StackEntry
}

const StackReference: React.FC<StackReferenceProps> = ({ entry }) => (
  <InlineBlock lineHeight={1.25}>
    {entry.fileName}:{entry.lineNumber}
  </InlineBlock>
)
