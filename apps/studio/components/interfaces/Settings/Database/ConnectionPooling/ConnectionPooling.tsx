import { zodResolver } from '@hookform/resolvers/zod'
import { PermissionAction } from '@supabase/shared-types/out/constants'
import { useParams } from 'common'
import { capitalize } from 'lodash'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import z from 'zod'

import { useProjectContext } from 'components/layouts/ProjectLayout/ProjectContext'
import AlertError from 'components/ui/AlertError'
import { DocsButton } from 'components/ui/DocsButton'
import { StringToPositiveNumber } from 'components/ui/Forms/Form.constants'
import { FormActions } from 'components/ui/Forms/FormActions'
import { InlineLink } from 'components/ui/InlineLink'
import Panel from 'components/ui/Panel'
import { useMaxConnectionsQuery } from 'data/database/max-connections-query'
import { usePgbouncerConfigQuery } from 'data/database/pgbouncer-config-query'
import { usePgbouncerConfigurationUpdateMutation } from 'data/database/pgbouncer-config-update-mutation'
import { usePgbouncerStatusQuery } from 'data/database/pgbouncer-status-query'
import { useSupavisorConfigurationQuery } from 'data/database/pooling-configuration-query'
import { useSupavisorConfigurationUpdateMutation } from 'data/database/pooling-configuration-update-mutation'
import { useProjectAddonsQuery } from 'data/subscriptions/project-addons-query'
import { useCheckPermissions } from 'hooks/misc/useCheckPermissions'
import { useFlag } from 'hooks/ui/useFlag'
import { toast } from 'sonner'
import { useDatabaseSettingsStateSnapshot } from 'state/database-settings'
import {
  AlertDescription_Shadcn_,
  AlertTitle_Shadcn_,
  Alert_Shadcn_,
  Badge,
  FormControl_Shadcn_,
  FormField_Shadcn_,
  Form_Shadcn_,
  Input_Shadcn_,
  Listbox,
  SelectContent_Shadcn_,
  SelectItem_Shadcn_,
  SelectTrigger_Shadcn_,
  SelectValue_Shadcn_,
  Select_Shadcn_,
  Separator,
} from 'ui'
import { Admonition } from 'ui-patterns'
import ConfirmationModal from 'ui-patterns/Dialogs/ConfirmationModal'
import { FormItemLayout } from 'ui-patterns/form/FormItemLayout/FormItemLayout'
import ShimmeringLoader from 'ui-patterns/ShimmeringLoader'
import {
  SESSION_MODE_DESCRIPTION,
  STATEMENT_MODE_DESCRIPTION,
  TRANSACTION_MODE_DESCRIPTION,
} from '../Database.constants'
import { POOLER_OPTIONS, POOLING_OPTIMIZATIONS } from './ConnectionPooling.constants'

const formId = 'pooling-configuration-form'

const PoolingConfigurationFormSchema = z.object({
  type: z.union([z.literal('Supavisor'), z.literal('PgBouncer')]),
  default_pool_size: StringToPositiveNumber,
  pool_mode: z.union([z.literal('transaction'), z.literal('session'), z.literal('statement')]),
  max_client_conn: StringToPositiveNumber,
})

export const ConnectionPooling = () => {
  const { ref: projectRef } = useParams()
  const { project } = useProjectContext()
  const snap = useDatabaseSettingsStateSnapshot()
  const allowPgBouncerSelection = useFlag('dualPoolerSupport')
  const [showConfirmation, setShowConfirmation] = useState(false)

  const canUpdateConnectionPoolingConfiguration = useCheckPermissions(
    PermissionAction.UPDATE,
    'projects',
    { resource: { project_id: project?.id } }
  )

  const {
    data: supavisorPoolingInfo,
    error: supavisorConfigError,
    isLoading: isLoadingSupavisorConfig,
    isError: isErrorSupavisorConfig,
    isSuccess: isSuccessSupavisorConfig,
  } = useSupavisorConfigurationQuery({ projectRef })
  const {
    data: pgbouncerConfig,
    error: pgbouncerConfigError,
    isLoading: isLoadingPgbouncerConfig,
    isError: isErrorPgbouncerConfig,
    isSuccess: isSuccessPgbouncerConfig,
  } = usePgbouncerConfigQuery({
    projectRef,
  })
  const { data: pgbouncerStatus, isSuccess: isSuccessPgbouncerStatus } = usePgbouncerStatusQuery({
    projectRef,
  })
  const { data: maxConnData } = useMaxConnectionsQuery({
    projectRef: project?.ref,
    connectionString: project?.connectionString,
  })
  const { data: addons } = useProjectAddonsQuery({ projectRef })

  const { mutate: updateSupavisorConfig, isLoading: isUpdatingSupavisor } =
    useSupavisorConfigurationUpdateMutation()
  const { mutate: updatePgbouncerConfig, isLoading: isUpdatingPgBouncer } =
    usePgbouncerConfigurationUpdateMutation()

  const form = useForm<z.infer<typeof PoolingConfigurationFormSchema>>({
    resolver: zodResolver(PoolingConfigurationFormSchema),
    defaultValues: {
      type: undefined,
      pool_mode: undefined,
      default_pool_size: undefined,
      max_client_conn: null,
    },
  })
  const { type, default_pool_size, max_client_conn } = form.watch()
  const error = useMemo(
    () => (type === 'PgBouncer' ? pgbouncerConfigError : supavisorConfigError),
    [type]
  )
  const isLoading = useMemo(
    () => (type === 'PgBouncer' ? isLoadingPgbouncerConfig : isLoadingSupavisorConfig),
    [type]
  )
  const isError = useMemo(
    () => (type === 'PgBouncer' ? isErrorPgbouncerConfig : isErrorSupavisorConfig),
    [type]
  )
  const isSuccess = useMemo(
    () => (type === 'PgBouncer' ? isSuccessPgbouncerConfig : isSuccessSupavisorConfig),
    [type]
  )
  const isSaving = isUpdatingSupavisor || isUpdatingPgBouncer

  // [Joshen] Pending confirmation with Kamil what's the best check here
  // const isPgbouncerActive = pgbouncerStatus?.active
  // [Joshen] Pending confirmation with Kamil what's the best check here
  const currentPooler = pgbouncerConfig?.pgbouncer_enabled ? 'PgBouncer' : 'Supavisor'
  const computeInstance = addons?.selected_addons.find((addon) => addon.type === 'compute_instance')
  const computeSize =
    computeInstance?.variant.name ?? capitalize(project?.infra_compute_size) ?? 'Micro'
  const poolingOptimizations =
    POOLING_OPTIMIZATIONS[
      (computeInstance?.variant.identifier as keyof typeof POOLING_OPTIMIZATIONS) ??
        (project?.infra_compute_size === 'nano' ? 'ci_nano' : 'ci_micro')
    ]
  const defaultPoolSize = poolingOptimizations.poolSize ?? 15
  const defaultMaxClientConn = poolingOptimizations.maxClientConn ?? 200

  const supavisorConfig = supavisorPoolingInfo?.find((x) => x.database_type === 'PRIMARY')
  const connectionPoolingUnavailable =
    type === 'PgBouncer' ? pgbouncerConfig?.pool_mode === null : supavisorConfig?.pool_mode === null
  const disablePoolModeSelection =
    type === 'Supavisor' && supavisorConfig?.pool_mode === 'transaction'
  const showPoolModeWarning = type === 'Supavisor' && supavisorConfig?.pool_mode === 'session'
  const isChangingPoolerType =
    (currentPooler === 'PgBouncer' && type === 'Supavisor') ||
    (currentPooler === 'Supavisor' && type === 'PgBouncer')

  const onSubmit: SubmitHandler<z.infer<typeof PoolingConfigurationFormSchema>> = async (data) => {
    const { type, pool_mode, default_pool_size, max_client_conn } = data

    if (!projectRef) return console.error('Project ref is required')
    if (isChangingPoolerType && !showConfirmation) return setShowConfirmation(true)

    if (type === 'PgBouncer') {
      if (!pgbouncerConfig) return console.error('Pgbouncer configuration is required')
      updatePgbouncerConfig(
        {
          ref: projectRef,
          pgbouncer_enabled: true,
          ignore_startup_parameters: pgbouncerConfig.ignore_startup_parameters ?? '',
          pool_mode: pgbouncerConfig.pool_mode as 'transaction' | 'session' | 'statement',
          max_client_conn,
        },
        {
          onSuccess: (data) => {
            toast.success(`Successfully updated PgBouncer configuration`)
            setShowConfirmation(false)
            form.reset({ type: 'PgBouncer', ...data })
          },
        }
      )
    } else if (type === 'Supavisor') {
      if (isChangingPoolerType && pgbouncerConfig) {
        updatePgbouncerConfig({
          ref: projectRef,
          pgbouncer_enabled: false,
          ignore_startup_parameters: pgbouncerConfig.ignore_startup_parameters ?? '',
          pool_mode: pgbouncerConfig.pool_mode as 'transaction' | 'session' | 'statement',
        })
      }
      updateSupavisorConfig(
        {
          ref: projectRef,
          default_pool_size,
          pool_mode: pool_mode as 'transaction' | 'session',
        },
        {
          onSuccess: (data) => {
            toast.success(`Successfully updated Supavisor configuration`)
            setShowConfirmation(false)
            form.reset({ type: 'Supavisor', ...data })
          },
        }
      )
    }
  }

  const resetForm = () => {
    if (currentPooler === 'PgBouncer') {
      if (pgbouncerConfig) {
        form.reset({
          type: 'PgBouncer',
          pool_mode: pgbouncerConfig.pool_mode,
          default_pool_size: pgbouncerConfig.default_pool_size,
          max_client_conn: pgbouncerConfig.max_client_conn,
        })
      }
    } else {
      if (supavisorConfig) {
        form.reset({
          type: 'Supavisor',
          pool_mode: supavisorConfig.pool_mode,
          default_pool_size: supavisorConfig.default_pool_size,
          max_client_conn: supavisorConfig.max_client_conn,
        })
      }
    }
  }

  useEffect(() => {
    // [Joshen] We're using pgbouncer_enabled from pgbouncer's config to determine the current type
    if (isSuccessPgbouncerStatus && isSuccessPgbouncerConfig && isSuccessSupavisorConfig) {
      resetForm()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccessPgbouncerStatus, isSuccessPgbouncerConfig, isSuccessSupavisorConfig])

  // [Joshen] Temp: This is really dumb but somehow RHF is setting max_client_conn to undefined
  // It should never be undefined, either a number of null, and I can't figure out why
  // I'm stuck figuring out why the form starts with being dirty if its on Supavisor too
  useEffect(() => {
    if (max_client_conn === undefined) {
      form.setValue('max_client_conn', null)
    }
  }, [max_client_conn])

  return (
    <section id="connection-pooler">
      <Panel
        className="!mb-0"
        title={
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-x-2">
              <p>Connection pooling configuration</p>
              {!allowPgBouncerSelection && <Badge>Supavisor</Badge>}
            </div>
            <DocsButton href="https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler" />
          </div>
        }
        footer={
          <FormActions
            form={formId}
            isSubmitting={isSaving}
            hasChanges={form.formState.isDirty}
            handleReset={() => resetForm()}
            helper={
              !canUpdateConnectionPoolingConfiguration
                ? 'You need additional permissions to update connection pooling settings'
                : undefined
            }
          />
        }
      >
        <Panel.Content>
          {isLoading && (
            <div className="flex flex-col gap-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Fragment key={`loader-${i}`}>
                  <div className="grid gap-2 items-center md:grid md:grid-cols-12 md:gap-x-4 w-full">
                    <ShimmeringLoader className="h-4 w-1/3 col-span-4" delayIndex={i} />
                    <ShimmeringLoader className="h-8 w-full col-span-8" delayIndex={i} />
                  </div>
                  <Separator />
                </Fragment>
              ))}

              <ShimmeringLoader className="h-8 w-full" />
            </div>
          )}
          {isError && (
            <AlertError
              error={error}
              subject="Failed to retrieve connection pooler configuration"
            />
          )}
          {isSuccess && (
            <>
              {connectionPoolingUnavailable && (
                <Admonition
                  type="default"
                  title="Unable to retrieve pooling configuration"
                  description="Please start a new project to enable this feature"
                />
              )}
              <Form_Shadcn_ {...form}>
                <form
                  id={formId}
                  className="flex flex-col gap-y-6 w-full"
                  onSubmit={form.handleSubmit(onSubmit)}
                >
                  {allowPgBouncerSelection && (
                    <FormField_Shadcn_
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItemLayout
                          layout="horizontal"
                          label="Pooler Type"
                          description={
                            isChangingPoolerType && (
                              <>
                                <Admonition
                                  type="warning"
                                  className="mt-2"
                                  title={`${type === 'PgBouncer' ? 'Supavisor' : 'PgBouncer'} will be active for 2 hours before fully deactivated`}
                                  description={`Migrate your applications from ${currentPooler} to ${type} during this time by switching to the right connection strings in your client applications`}
                                />
                                {type === 'PgBouncer' && (
                                  <Admonition
                                    type="default"
                                    className="mt-2"
                                    title="PgBouncer does not support IPv4"
                                    description={
                                      <>
                                        If you were using Supavisor for IPv6, we recommend
                                        purchasing a dedicated IPv4 address from the{' '}
                                        <InlineLink
                                          href={`/project/${projectRef}/settings/addons?panel=ipv4`}
                                        >
                                          add-ons page
                                        </InlineLink>{' '}
                                        before changing your pooler to PgBouncer
                                      </>
                                    }
                                  />
                                )}
                              </>
                            )
                          }
                        >
                          <Select_Shadcn_
                            {...field}
                            onValueChange={(e) => {
                              field.onChange(e)
                              if (e === 'Supavisor' && supavisorConfig) {
                                form.setValue('type', 'Supavisor')
                                form.setValue('pool_mode', supavisorConfig.pool_mode)
                                form.setValue(
                                  'default_pool_size',
                                  supavisorConfig.default_pool_size
                                )
                                form.setValue('max_client_conn', supavisorConfig.max_client_conn)
                              } else if (e === 'pgBouncer' && pgbouncerConfig) {
                                form.setValue('type', 'PgBouncer')
                                form.setValue('pool_mode', pgbouncerConfig.pool_mode as any)
                                form.setValue(
                                  'default_pool_size',
                                  pgbouncerConfig.default_pool_size as any
                                )
                                form.setValue(
                                  'max_client_conn',
                                  pgbouncerConfig.max_client_conn ?? null
                                )
                              }
                            }}
                          >
                            <FormControl_Shadcn_>
                              <SelectTrigger_Shadcn_ className="max-w-64">
                                <SelectValue_Shadcn_ />
                              </SelectTrigger_Shadcn_>
                            </FormControl_Shadcn_>
                            <SelectContent_Shadcn_>
                              {POOLER_OPTIONS.map((x) => (
                                <SelectItem_Shadcn_ key={x.value} value={x.value}>
                                  <div className="flex flex-col gap-y-1 items-start">
                                    <p className="text-sm text-foreground">{x.label}</p>
                                  </div>
                                </SelectItem_Shadcn_>
                              ))}
                            </SelectContent_Shadcn_>
                          </Select_Shadcn_>
                        </FormItemLayout>
                      )}
                    />
                  )}

                  <FormField_Shadcn_
                    control={form.control}
                    name="pool_mode"
                    render={({ field }) => (
                      <FormItemLayout
                        layout="horizontal"
                        label="Pool Mode"
                        description={
                          <>
                            {disablePoolModeSelection && (
                              <Alert_Shadcn_ className="mt-0">
                                <AlertTitle_Shadcn_ className="text-foreground">
                                  Pool mode is permanently set to Transaction on port 6543
                                </AlertTitle_Shadcn_>
                                <AlertDescription_Shadcn_>
                                  You can use Session mode by connecting to the pooler on port 5432
                                  instead
                                </AlertDescription_Shadcn_>
                              </Alert_Shadcn_>
                            )}
                            {showPoolModeWarning && (
                              <>
                                {field.value === 'transaction' ? (
                                  <Admonition
                                    type="warning"
                                    title="Pool mode will be set to transaction permanently on port 6543"
                                    description="This will take into effect once saved. If you are using Session mode with port 6543 in your applications, please update to use port 5432 instead before saving."
                                  />
                                ) : (
                                  <>
                                    <Panel.Notice
                                      layout="vertical"
                                      className="border rounded-lg"
                                      title="Deprecating Session Mode on Port 6543"
                                      description="On February 28, 2025, Supavisor is deprecating Session Mode on port 6543. Please update your application/database clients to use port 5432 for Session Mode."
                                      href="https://github.com/orgs/supabase/discussions/32755"
                                      buttonText="Read the announcement"
                                    />
                                    <Admonition
                                      className="mt-2"
                                      showIcon={false}
                                      type="default"
                                      title="Set to transaction mode to use both pooling modes concurrently"
                                      description="Session mode can be used concurrently with transaction mode by
                                                    using 5432 for session and 6543 for transaction. However, by
                                                    configuring the pooler mode to session here, you will not be able
                                                    to use transaction mode at the same time."
                                    />
                                  </>
                                )}
                              </>
                            )}
                            <p className="mt-2">
                              Specify when a connection can be returned to the pool.{' '}
                              <span
                                tabIndex={0}
                                onClick={() => snap.setShowPoolingModeHelper(true)}
                                className="transition cursor-pointer underline underline-offset-2 decoration-foreground-lighter hover:decoration-foreground text-foreground"
                              >
                                Learn more about pool modes
                              </span>
                              .
                            </p>
                          </>
                        }
                      >
                        <FormControl_Shadcn_>
                          <Listbox
                            disabled={disablePoolModeSelection}
                            value={field.value}
                            className="w-full"
                            onChange={(value) => field.onChange(value)}
                          >
                            <Listbox.Option
                              key="transaction"
                              label="Transaction"
                              value="transaction"
                            >
                              <p>Transaction mode</p>
                              <p className="text-xs text-foreground-lighter">
                                {TRANSACTION_MODE_DESCRIPTION}
                              </p>
                            </Listbox.Option>
                            <Listbox.Option key="session" label="Session" value="session">
                              <p>Session mode</p>
                              <p className="text-xs text-foreground-lighter">
                                {SESSION_MODE_DESCRIPTION}
                              </p>
                            </Listbox.Option>
                            {type === 'PgBouncer' && (
                              <Listbox.Option key="statement" label="Session" value="statement">
                                <p>Statement mode</p>
                                <p className="text-xs text-foreground-lighter">
                                  {STATEMENT_MODE_DESCRIPTION}
                                </p>
                              </Listbox.Option>
                            )}
                          </Listbox>
                        </FormControl_Shadcn_>
                      </FormItemLayout>
                    )}
                  />

                  <FormField_Shadcn_
                    control={form.control}
                    name="default_pool_size"
                    render={({ field }) => (
                      <FormItemLayout
                        layout="horizontal"
                        label="Pool Size"
                        description={
                          <>
                            <p>
                              The maximum number of connections made to the underlying Postgres
                              cluster, per user+db combination. Pool size has a default of{' '}
                              {defaultPoolSize} based on your compute size of {computeSize}.
                            </p>
                            {type === 'Supavisor' && (
                              <p className="mt-2">
                                Please refer to our{' '}
                                <InlineLink href="https://supabase.com/docs/guides/database/connection-management#configuring-supavisors-pool-size">
                                  documentation
                                </InlineLink>{' '}
                                to find out more.
                              </p>
                            )}
                          </>
                        }
                      >
                        <FormControl_Shadcn_>
                          <Input_Shadcn_
                            {...field}
                            type="number"
                            className="w-full"
                            value={field.value || undefined}
                            placeholder={!field.value ? `${defaultPoolSize}` : ''}
                          />
                        </FormControl_Shadcn_>
                        {!!maxConnData &&
                          (default_pool_size ?? 15) > maxConnData.maxConnections * 0.8 && (
                            <Alert_Shadcn_ variant="warning" className="mt-2">
                              <AlertTitle_Shadcn_ className="text-foreground">
                                Pool size is greater than 80% of the max connections (
                                {maxConnData.maxConnections}) on your database
                              </AlertTitle_Shadcn_>
                              <AlertDescription_Shadcn_>
                                This may result in instability and unreliability with your database
                                connections.
                              </AlertDescription_Shadcn_>
                            </Alert_Shadcn_>
                          )}
                      </FormItemLayout>
                    )}
                  />

                  <FormField_Shadcn_
                    disabled={type === 'Supavisor'}
                    control={form.control}
                    name="max_client_conn"
                    render={({ field }) => (
                      <FormItemLayout
                        layout="horizontal"
                        label="Max Client Connections"
                        description={
                          <>
                            <p>
                              The maximum number of concurrent client connections allowed.{' '}
                              {type === 'Supavisor' ? (
                                <>
                                  This value is fixed at {defaultMaxClientConn} based on your
                                  compute size of {computeSize} and cannot be changed.
                                </>
                              ) : (
                                <>
                                  This has a default of {defaultMaxClientConn} based on your compute
                                  size of {computeSize}.
                                </>
                              )}
                            </p>
                            {type === 'Supavisor' && (
                              <p className="mt-2">
                                Please refer to our{' '}
                                <InlineLink href="https://supabase.com/docs/guides/database/connection-management#configuring-supavisors-pool-size">
                                  documentation
                                </InlineLink>{' '}
                                to find out more.
                              </p>
                            )}
                          </>
                        }
                      >
                        <FormControl_Shadcn_>
                          <Input_Shadcn_
                            {...field}
                            type="number"
                            className="w-full"
                            value={field.value || ''}
                            placeholder={!field.value ? `${defaultMaxClientConn}` : ''}
                          />
                        </FormControl_Shadcn_>
                      </FormItemLayout>
                    )}
                  />
                </form>
              </Form_Shadcn_>
            </>
          )}
        </Panel.Content>
      </Panel>
      <ConfirmationModal
        size="large"
        visible={showConfirmation}
        loading={isSaving}
        title={`Confirm switching pooler type to ${type}`}
        confirmLabel="Confirm"
        onCancel={() => setShowConfirmation(false)}
        onConfirm={() => onSubmit(form.getValues())}
        alert={{
          base: { variant: 'warning' },
          title: `Current pooler ${currentPooler} will be active for 2 hours before fully deactivated`,
          description: `Migrate your applications from ${currentPooler} to ${type} during this time by switching to the right connection strings in your client applications`,
        }}
      >
        <p className="text-sm text-foreground-light">
          Are you sure you wish to switch your pooler type to {type} and apply the provided
          configurations?
        </p>
      </ConfirmationModal>
    </section>
  )
}
