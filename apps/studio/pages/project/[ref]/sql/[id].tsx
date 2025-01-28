import { useRouter } from 'next/router'
import { useEffect } from 'react'

import { useParams } from 'common/hooks/useParams'
import { useFeaturePreviewContext } from 'components/interfaces/App/FeaturePreview/FeaturePreviewContext'
import { SQLEditor } from 'components/interfaces/SQLEditor/SQLEditor'
import { EditorBaseLayout } from 'components/layouts/editors/editor-base-layout'
import { ProjectContextFromParamsProvider } from 'components/layouts/ProjectLayout/ProjectContext'
import SQLEditorLayout from 'components/layouts/SQLEditorLayout/SQLEditorLayout'
import { SQLEditorMenu } from 'components/layouts/SQLEditorLayout/SQLEditorMenu'
import { useContentIdQuery } from 'data/content/content-id-query'
import { LOCAL_STORAGE_KEYS } from 'lib/constants'
import { useAppStateSnapshot } from 'state/app-state'
import { SnippetWithContent, useSnippets, useSqlEditorV2StateSnapshot } from 'state/sql-editor-v2'
import { addTab, createTabId } from 'state/tabs'
import type { NextPageWithLayout } from 'types'

const SqlEditor: NextPageWithLayout = () => {
  const router = useRouter()
  const { id, ref, content, skip } = useParams()

  const appSnap = useAppStateSnapshot()
  const snapV2 = useSqlEditorV2StateSnapshot()

  const allSnippets = useSnippets(ref!)

  // [Refactor] There's an unnecessary request getting triggered when we start typing while on /new
  // the URL ID gets updated and we attempt to fetch content for a snippet that's not been created yet
  const { data } = useContentIdQuery(
    { projectRef: ref, id },
    {
      // [Joshen] May need to investigate separately, but occasionally addSnippet doesnt exist in
      // the snapV2 valtio store for some reason hence why the added typeof check here
      retry: false,
      enabled: Boolean(id !== 'new' && typeof snapV2.addSnippet === 'function'),
    }
  )

  useEffect(() => {
    if (ref && data) {
      snapV2.setSnippet(ref, data as unknown as SnippetWithContent)
    }
  }, [ref, data])

  // Load the last visited snippet when landing on /new
  useEffect(() => {
    if (
      id === 'new' &&
      skip !== 'true' && // [Joshen] Skip flag implies to skip loading the last visited snippet
      appSnap.dashboardHistory.sql !== undefined &&
      content === undefined
    ) {
      const snippet = allSnippets.find((snippet) => snippet.id === appSnap.dashboardHistory.sql)
      if (snippet !== undefined) router.push(`/project/${ref}/sql/${appSnap.dashboardHistory.sql}`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, allSnippets, content])

  const { flags } = useFeaturePreviewContext()
  const isSqlEditorTabsEnabled = flags[LOCAL_STORAGE_KEYS.UI_SQL_EDITOR_TABS]
  // Watch for route changes
  useEffect(() => {
    if (isSqlEditorTabsEnabled) {
      if (!router.isReady || !id || id === 'new') return

      const tabId = createTabId('sql', { id })
      const snippet = data

      addTab(ref, {
        id: tabId,
        type: 'sql',
        label: snippet?.name || 'Untitled Query',
        metadata: {
          sqlId: id,
          name: snippet?.name,
        },
      })
    }
  }, [router.isReady, id, data, isSqlEditorTabsEnabled])

  return <SQLEditor />
}

SqlEditor.getLayout = (page) => (
  <ProjectContextFromParamsProvider>
    <EditorBaseLayout productMenu={<SQLEditorMenu />} product="SQL Editor">
      <SQLEditorLayout>{page}</SQLEditorLayout>
    </EditorBaseLayout>
  </ProjectContextFromParamsProvider>
)

export default SqlEditor
