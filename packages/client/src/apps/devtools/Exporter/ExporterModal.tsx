import { Block, Grid, InlineBlock, Row } from 'jsxstyle'
import React, { useEffect, useState } from 'react'
import {
  CheckCircle as SuccessIcon,
  Loader as LoaderIcon,
  X as CloseIcon,
} from 'react-feather'
import { Shortcuts } from 'shortcuts'
import { Spin } from '@/components/FX'
import { Logo } from '@/components/Logo'
import { Modal } from '@/components/Modal'
import { colors } from '@/config/theme'
import { Stats } from '@/libs/diagnostics'
import { useMessaging } from '@/libs/messaging'
import {
  EMPTY_PLAYBACK,
  PlaybackCanvas,
  PlaybackProvider,
  usePlayback,
} from '@/libs/playback'
import {
  Recording,
  SnapshotEvent,
  SourceEvent,
  SourceEventType,
} from '@/types/recording'
import { ArrayBufferBackedList } from '@/utils/lang'
import { applyEventToSnapshot, createRecordingId } from '@/utils/source'
import {
  createEventDecoder,
  createEventEncoder,
  readEventTime,
  readEventType,
  writeEventTimeOffset,
} from '@/libs/codecs/event'
import { copy as copyArrayBuffer } from '@/libs/codecs/common'
import { encodeRecording } from '@/libs/codecs/recording'
import { MAX_INT32 } from '../constants'
import { ExporterButton } from './ExporterButton'
import { RangeSelector } from './RangeSelector'

type PlaybackRange = [number, number]
type UploadingState = 'ready' | 'uploading' | 'done' | 'failed'

interface Props {
  onClose(): void
}

function createRecordingAtRange(
  sourceEvents: ArrayBufferBackedList<SourceEvent>,
  range: PlaybackRange
): Recording {
  const eventBuffers: Array<ArrayBuffer> = []
  let duration = 0

  const eventDecoder = createEventDecoder()
  const eventEncoder = createEventEncoder()

  Stats.time('ExporterModal: create recording from range', () => {
    let leadingSnapshotBuffer: ArrayBuffer | null = null
    const leadingEventBuffers: Array<ArrayBuffer> = []

    let trailingSnapshotBuffer: ArrayBuffer | null = null
    const trailingEventBuffers: Array<ArrayBuffer> = []

    for (let i = 0, len = sourceEvents.size(); i < len; i++) {
      const event = sourceEvents.at(i)

      if (event) {
        const time = readEventTime(event)
        const type = readEventType(event)

        if (time <= range[0]) {
          if (type === SourceEventType.Snapshot) {
            leadingSnapshotBuffer = copyArrayBuffer(event)
            leadingEventBuffers.length = 0
          } else {
            leadingEventBuffers.push(event)
          }
        } else if (time > range[0] && time < range[1]) {
          eventBuffers.push(copyArrayBuffer(event))
        } else if (time >= range[1]) {
          if (trailingSnapshotBuffer === null) {
            if (type === SourceEventType.Snapshot) {
              trailingSnapshotBuffer = copyArrayBuffer(event)
            } else {
              trailingEventBuffers.unshift(event)
            }
          }
        }
      }
    }

    if (!leadingSnapshotBuffer || !trailingSnapshotBuffer) {
      throw new Error('ExporterModal: cannot find leading or trailing snapshot')
    }

    if (leadingEventBuffers.length > 0) {
      const leadingSnapshotEvent = eventDecoder(
        leadingSnapshotBuffer
      ) as SnapshotEvent

      for (const buffer of leadingEventBuffers) {
        const event = eventDecoder(buffer)
        applyEventToSnapshot(leadingSnapshotEvent.data, event, event.time)
        leadingSnapshotEvent.time = event.time
      }

      leadingSnapshotBuffer = eventEncoder(leadingSnapshotEvent)
    }

    if (trailingEventBuffers.length > 0) {
      const trailingSnapshotEvent = eventDecoder(
        trailingSnapshotBuffer
      ) as SnapshotEvent

      for (const buffer of trailingEventBuffers) {
        const event = eventDecoder(buffer)
        applyEventToSnapshot(
          trailingSnapshotEvent.data,
          event,
          event.time,
          true
        )
        trailingSnapshotEvent.time = event.time
      }

      trailingSnapshotBuffer = eventEncoder(trailingSnapshotEvent)
    }

    eventBuffers.unshift(leadingSnapshotBuffer)
    eventBuffers.push(trailingSnapshotBuffer)

    const firstEvent = eventBuffers[0]
    const lastEvent = eventBuffers[eventBuffers.length - 1]

    duration =
      firstEvent && lastEvent
        ? readEventTime(lastEvent) - readEventTime(firstEvent)
        : 0

    const timeOffset = firstEvent ? readEventTime(firstEvent) : 0

    for (const event of eventBuffers) {
      writeEventTimeOffset(event, timeOffset)
    }
  })

  return {
    id: createRecordingId(),
    events: new ArrayBufferBackedList(eventBuffers, eventDecoder, eventEncoder),
    duration,
  }
}

export const ExporterModal: React.FC<Props> = ({ onClose }) => {
  const agent = useMessaging()
  const sourcePlayback = usePlayback()
  const [playback, setPlayback] = useState(EMPTY_PLAYBACK)

  const initialRange: PlaybackRange = [0, playback.getDuration()]
  const [range, setRange] = useState<PlaybackRange>(initialRange)
  const [uploading, setUploading] = useState<UploadingState>('ready')
  const [recordingURL, setRecordingURL] = useState<string | null>(null)

  useEffect(() => {
    setPlayback(sourcePlayback.copy())
  }, [sourcePlayback, setPlayback])

  useEffect(() => {
    setRange([0, playback.getDuration()])
  }, [playback, setRange])

  useEffect(() => {
    playback.seekToTime(range[0])
  }, [playback, range])

  useEffect(() => {
    const shortcuts = new Shortcuts()

    if (!uploading) {
      shortcuts.add({
        shortcut: 'Escape',
        handler: onClose,
      })
    }

    return () => {
      shortcuts.reset()
    }
  }, [uploading, onClose])

  const handleExport = async () => {
    const events = playback.getSourceEvents()

    if (events) {
      const recording = createRecordingAtRange(events, range)
      const data = encodeRecording(recording)

      setUploading('uploading')

      const [ok, url]: [boolean, string] = await agent.raiseIntent({
        type: 'upload',
        payload: {
          id: recording.id,
          recording: Array.from(new Uint8Array(data)),
          assets: [],
        },
      })

      if (ok) {
        setUploading('done')
        setRecordingURL(url)
      } else {
        setUploading('failed')
      }
    }
  }

  if (recordingURL) {
    console.log(`http://localhost:8000${recordingURL}`)
  }

  return (
    <PlaybackProvider playback={playback}>
      <Block isolation="isolate" zIndex={MAX_INT32}>
        <Modal width="auto" height="auto">
          <Grid width="80vw" height="80vh" gridTemplateRows="auto 1fr auto">
            <HeaderRegion>
              <Logo size={20} />
              <Block justifySelf="center" fontSize={14} fontWeight={700}>
                Edit & Save Recording
              </Block>
              <InlineBlock
                justifySelf="end"
                cursor="pointer"
                props={{ onClick: onClose }}
              >
                <CloseIcon size={16} />
              </InlineBlock>
            </HeaderRegion>
            <PlaybackCanvas interactive={false} scaling="scale-to-fit" />
            <FooterRegion>
              <RangeSelector
                disabled={uploading === 'uploading'}
                minValue={0}
                maxValue={playback.getDuration()}
                value={range}
                onChange={setRange}
              />
              <ExporterButton
                disabled={uploading === 'uploading'}
                onClick={handleExport}
              />
            </FooterRegion>
            {uploading === 'uploading' && <UploadingInterstitial />}
            {uploading === 'done' && <SuccessInterstitial />}
          </Grid>
        </Modal>
      </Block>
    </PlaybackProvider>
  )
}

const HeaderRegion: React.FC = ({ children }) => (
  <Grid
    gridColumnGap={16}
    gridTemplateColumns="100px 1fr 100px"
    height={50}
    alignItems="center"
    paddingH={16}
    background={colors.white}
    borderBottomStyle="solid"
    borderBottomWidth={1}
    borderBottomColor={colors.slate['300']}
    boxShadow="0 4px 16px rgba(0, 0, 0, 0.1)"
    isolation="isolate"
    zIndex={MAX_INT32}
  >
    {children}
  </Grid>
)

const FooterRegion: React.FC = ({ children }) => (
  <Grid
    gridColumnGap={16}
    gridTemplateColumns="1fr auto"
    height={50}
    alignItems="center"
    paddingH={16}
    background={colors.white}
    borderTopStyle="solid"
    borderTopWidth={1}
    borderTopColor={colors.slate['300']}
    boxShadow="0 -4px 16px rgba(0, 0, 0, 0.1)"
    isolation="isolate"
    zIndex={MAX_INT32}
  >
    {children}
  </Grid>
)

const UploadingInterstitial: React.FC = () => (
  <Row
    alignItems="center"
    justifyContent="center"
    position="absolute"
    top={0}
    bottom={0}
    left={0}
    right={0}
    zIndex={MAX_INT32}
    background="rgba(0, 0, 0, 0.85)"
    color={colors.white}
    fontSize={24}
  >
    <Spin>
      <LoaderIcon size={24} />
    </Spin>

    <InlineBlock marginLeft={8}>Saving recording...</InlineBlock>
  </Row>
)

const SuccessInterstitial: React.FC = () => (
  <Row
    alignItems="center"
    justifyContent="center"
    position="absolute"
    top={0}
    bottom={0}
    left={0}
    right={0}
    zIndex={MAX_INT32}
    background="rgba(0, 0, 0, 0.85)"
    color={colors.white}
    fontSize={24}
  >
    <SuccessIcon size={24} />
    <InlineBlock marginLeft={8}>Saved</InlineBlock>
  </Row>
)
