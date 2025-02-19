import { zodResolver } from '@hookform/resolvers/zod'
import { useParams } from 'common'
import { useCreatePipelineMutation } from 'data/replication/create-pipeline-mutation'
import { useCreateSinkMutation } from 'data/replication/create-sink-mutation'
import { useCreateSourceMutation } from 'data/replication/create-source-mutation'
import { useStartPipelineMutation } from 'data/replication/start-pipeline-mutation'
import { useRef } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import {
  Button,
  Form_Shadcn_,
  FormControl_Shadcn_,
  FormField_Shadcn_,
  FormItem_Shadcn_,
  FormLabel_Shadcn_,
  FormMessage_Shadcn_,
  Input_Shadcn_,
  Select_Shadcn_,
  SelectContent_Shadcn_,
  SelectGroup_Shadcn_,
  SelectItem_Shadcn_,
  SelectTrigger_Shadcn_,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetSection,
  SheetTitle,
  SidePanel,
  Switch,
  TextArea_Shadcn_,
} from 'ui'
import * as z from 'zod'

interface NewDestinationPanelProps {
  visible: boolean
  sourceId: number | undefined
  onClose: () => void
}

const NewDestinationPanel = ({ visible, sourceId, onClose }: NewDestinationPanelProps) => {
  const { ref: projectRef } = useParams()
  const { mutateAsync: createSource, isLoading: creatingSource } = useCreateSourceMutation()
  const { mutateAsync: createSink, isLoading: creatingSink } = useCreateSinkMutation()
  const { mutateAsync: createPipeline, isLoading: creatingPipeline } = useCreatePipelineMutation()
  const { mutateAsync: startPipeline, isLoading: startingPipeline } = useStartPipelineMutation()

  const isLoading = creatingSource || creatingSink || creatingPipeline || startingPipeline

  const formId = 'destination-editor'
  const types = ['BigQuery'] as const
  const TypeEnum = z.enum(types)
  const FormSchema = z.object({
    type: TypeEnum,
    name: z.string(),
    projectId: z.string(),
    datasetId: z.string(),
    serviceAccountKey: z.string(),
    publicationName: z.string(),
    maxSize: z.number(),
    maxFillSecs: z.number(),
    enabled: z.boolean(),
  })
  const defaultValues = {
    type: TypeEnum.enum.BigQuery,
    name: '',
    projectId: '',
    datasetId: '',
    serviceAccountKey: '',
    publicationName: '',
    maxSize: 1000,
    maxFillSecs: 10,
    enabled: true,
  }
  const form = useForm<z.infer<typeof FormSchema>>({
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    resolver: zodResolver(FormSchema),
    defaultValues,
  })
  const onSubmit = async (data: z.infer<typeof FormSchema>) => {
    if (!projectRef) return console.error('Project ref is required')
    try {
      if (!sourceId) {
        const { id } = await createSource({ projectRef })
        sourceId = id
      }
      const { id: sinkId } = await createSink({
        projectRef,
        sink_name: data.name,
        project_id: data.projectId,
        dataset_id: data.datasetId,
        service_account_key: data.serviceAccountKey,
      })
      const { id: pipelineId } = await createPipeline({
        projectRef,
        sourceId,
        sinkId,
        publicationName: data.publicationName,
        config: { config: { maxSize: data.maxSize, maxFillSecs: data.maxFillSecs } },
      })
      if (data.enabled) {
        await startPipeline({ projectRef, pipelineId })
      }
      toast.success('Successfully created destination')
      onClose()
    } catch (error) {
      toast.error('Failed to create destination')
    }
    form.reset(defaultValues)
  }

  const { enabled } = form.watch()

  return (
    <>
      <Sheet open={visible} onOpenChange={onClose}>
        <SheetContent showClose={false} size="default">
          <div className="flex flex-col h-full" tabIndex={-1}>
            <SheetHeader>
              <SheetTitle>
                <div className="flex items-center justify-between">
                  <div>
                    <div>New Destination</div>
                    <div className="text-xs">Send data to a new destination</div>
                  </div>
                  <div className="flex">
                    <Switch
                      checked={enabled}
                      onCheckedChange={(checked) => {
                        form.setValue('enabled', checked)
                      }}
                    />
                    <div className="text-sm mx-2">Enable</div>
                  </div>
                </div>
              </SheetTitle>
            </SheetHeader>
            <SheetSection className="flex-grow overflow-auto">
              <Form_Shadcn_ {...form}>
                <form id={formId} onSubmit={form.handleSubmit(onSubmit)}>
                  <p className="mb-2">Where to send</p>
                  <div className="flex flex-col border border-border rounded-md">
                    <FormField_Shadcn_
                      name="type"
                      control={form.control}
                      render={({ field }) => (
                        <FormItem_Shadcn_ className="flex flex-row justify-between items-center p-4 border-b">
                          <FormLabel_Shadcn_>Type</FormLabel_Shadcn_>
                          <div className="w-96">
                            <FormControl_Shadcn_>
                              <Select_Shadcn_ value={field.value}>
                                <SelectTrigger_Shadcn_>{field.value}</SelectTrigger_Shadcn_>
                                <SelectContent_Shadcn_>
                                  <SelectGroup_Shadcn_>
                                    <SelectItem_Shadcn_ value="BigQuery">
                                      BigQuery
                                    </SelectItem_Shadcn_>
                                  </SelectGroup_Shadcn_>
                                </SelectContent_Shadcn_>
                              </Select_Shadcn_>
                            </FormControl_Shadcn_>
                          </div>
                          <FormMessage_Shadcn_ />
                        </FormItem_Shadcn_>
                      )}
                    ></FormField_Shadcn_>
                    <FormField_Shadcn_
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem_Shadcn_ className="flex flex-row justify-between items-center p-4 border-b">
                          <FormLabel_Shadcn_>Name</FormLabel_Shadcn_>
                          <div className="w-96">
                            <FormControl_Shadcn_>
                              <Input_Shadcn_ {...field} placeholder="Name" />
                            </FormControl_Shadcn_>
                          </div>
                          <FormMessage_Shadcn_ />
                        </FormItem_Shadcn_>
                      )}
                    />
                    <FormField_Shadcn_
                      control={form.control}
                      name="projectId"
                      render={({ field }) => (
                        <FormItem_Shadcn_ className="flex flex-row justify-between items-center p-4 border-b">
                          <FormLabel_Shadcn_>Project Id</FormLabel_Shadcn_>
                          <div className="w-96">
                            <FormControl_Shadcn_>
                              <Input_Shadcn_ {...field} placeholder="Project id" />
                            </FormControl_Shadcn_>
                          </div>
                          <FormMessage_Shadcn_ />
                        </FormItem_Shadcn_>
                      )}
                    />
                    <FormField_Shadcn_
                      control={form.control}
                      name="datasetId"
                      render={({ field }) => (
                        <FormItem_Shadcn_ className="flex flex-row justify-between items-center p-4 border-b">
                          <FormLabel_Shadcn_>Dataset Id</FormLabel_Shadcn_>
                          <div className="w-96">
                            <FormControl_Shadcn_>
                              <Input_Shadcn_ {...field} placeholder="Dataset id" />
                            </FormControl_Shadcn_>
                          </div>
                          <FormMessage_Shadcn_ />
                          <FormMessage_Shadcn_ />
                        </FormItem_Shadcn_>
                      )}
                    />
                    <FormField_Shadcn_
                      control={form.control}
                      name="serviceAccountKey"
                      render={({ field }) => (
                        <FormItem_Shadcn_ className="flex flex-row justify-between items-center p-4">
                          <FormLabel_Shadcn_>Service Account Key</FormLabel_Shadcn_>
                          <div className="w-96">
                            <FormControl_Shadcn_>
                              <TextArea_Shadcn_
                                {...field}
                                rows={4}
                                maxLength={5000}
                                placeholder="Service account key"
                              />
                            </FormControl_Shadcn_>
                          </div>
                          <FormMessage_Shadcn_ />
                        </FormItem_Shadcn_>
                      )}
                    />
                  </div>
                  <p className="mt-6 mb-2">What to send</p>
                  <div className="flex flex-col border border-border rounded-md">
                    <FormField_Shadcn_
                      control={form.control}
                      name="publicationName"
                      render={({ field }) => (
                        <FormItem_Shadcn_ className="flex flex-row justify-between items-center p-4">
                          <FormLabel_Shadcn_>Publication Name</FormLabel_Shadcn_>
                          <div className="w-96">
                            <FormControl_Shadcn_>
                              <Input_Shadcn_ {...field} placeholder="Publication name" />
                            </FormControl_Shadcn_>
                          </div>
                          <FormMessage_Shadcn_ />
                        </FormItem_Shadcn_>
                      )}
                    />
                  </div>
                  <p className="mt-6 mb-2">Advanced Settings</p>
                  <div className="flex flex-col border border-border rounded-md">
                    <FormField_Shadcn_
                      control={form.control}
                      name="maxSize"
                      render={({ field }) => (
                        <FormItem_Shadcn_ className="flex flex-row justify-between items-center p-4 border-b">
                          <FormLabel_Shadcn_>Max Size</FormLabel_Shadcn_>
                          <div className="w-96">
                            <FormControl_Shadcn_>
                              <Input_Shadcn_ {...field} placeholder="Max size" />
                            </FormControl_Shadcn_>
                          </div>
                          <FormMessage_Shadcn_ />
                        </FormItem_Shadcn_>
                      )}
                    />
                    <FormField_Shadcn_
                      control={form.control}
                      name="maxFillSecs"
                      render={({ field }) => (
                        <FormItem_Shadcn_ className="flex flex-row justify-between items-center p-4">
                          <FormLabel_Shadcn_>Max Fill Seconds</FormLabel_Shadcn_>
                          <div className="w-96">
                            <FormControl_Shadcn_>
                              <Input_Shadcn_ {...field} placeholder="Max fill seconds" />
                            </FormControl_Shadcn_>
                          </div>
                          <FormMessage_Shadcn_ />
                        </FormItem_Shadcn_>
                      )}
                    />
                    <div className="hidden">
                      <FormField_Shadcn_
                        control={form.control}
                        name="enabled"
                        render={({ field }) => (
                          <FormItem_Shadcn_ className="flex flex-row justify-between items-center p-4">
                            <FormLabel_Shadcn_>Enabled</FormLabel_Shadcn_>
                            <FormControl_Shadcn_>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                disabled={field.disabled}
                              />
                            </FormControl_Shadcn_>
                            <FormMessage_Shadcn_ />
                          </FormItem_Shadcn_>
                        )}
                      />
                    </div>
                  </div>
                </form>
              </Form_Shadcn_>
            </SheetSection>
            <SheetFooter>
              <Button disabled={isLoading} type="default" onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={isLoading} loading={isLoading} form={formId} htmlType="submit">
                Create
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

export default NewDestinationPanel
