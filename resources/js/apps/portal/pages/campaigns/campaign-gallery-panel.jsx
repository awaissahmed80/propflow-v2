import { AccordionContent, AccordionItem } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { FieldLabel, ToolPanel, ToolTrigger } from './campaign-details-shared';

export function CampaignGalleryPanel({
    heroImage,
    heroImageIds,
    gallery,
    galleryIds,
    setMediaManager,
    setGalleryPreviewIndex,
}) {
    return (
        <AccordionItem value="gallery" className="border-border/70">
            <ToolTrigger icon="image-line" label="Gallery Images" />
            <AccordionContent className="pt-0 pb-0 [&_p:not(:last-child)]:mb-0">
                <ToolPanel>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <FieldLabel>Hero image</FieldLabel>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() =>
                                    setMediaManager({
                                        linkage: 'THUMBNAIL',
                                        multiple: false,
                                        selectedIds: heroImageIds,
                                        title: 'Campaign hero image',
                                        description:
                                            'Choose one image for the landing page hero.',
                                    })
                                }
                            >
                                <Icon
                                    name="image-add-line"
                                    className="text-sm"
                                />
                                {heroImage ? 'Change' : 'Choose'}
                            </Button>
                        </div>
                        <button
                            type="button"
                            className="group relative aspect-[16/7] w-full overflow-hidden rounded-lg border border-border bg-muted/30"
                            onClick={() =>
                                setMediaManager({
                                    linkage: 'THUMBNAIL',
                                    multiple: false,
                                    selectedIds: heroImageIds,
                                    title: 'Campaign hero image',
                                    description:
                                        'Choose one image for the landing page hero.',
                                })
                            }
                        >
                            {heroImage ? (
                                <img
                                    src={heroImage}
                                    alt=""
                                    className="size-full object-cover"
                                />
                            ) : (
                                <span className="flex size-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
                                    <Icon
                                        name="image-add-line"
                                        className="text-2xl"
                                    />
                                    <span className="text-xs">
                                        Select from media library
                                    </span>
                                </span>
                            )}
                            <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                                <Icon
                                    name="camera-line"
                                    className="text-xl text-white"
                                />
                            </span>
                        </button>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <FieldLabel>Gallery</FieldLabel>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs"
                                onClick={() =>
                                    setMediaManager({
                                        linkage: 'GALLERY',
                                        multiple: true,
                                        selectedIds: galleryIds,
                                        title: 'Campaign gallery',
                                        description:
                                            'Select images for this campaign gallery.',
                                    })
                                }
                            >
                                <Icon name="add-line" className="text-sm" />
                                Manage
                            </Button>
                        </div>
                        {gallery.length === 0 ? (
                            <button
                                type="button"
                                className="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-6 text-center text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/30"
                                onClick={() =>
                                    setMediaManager({
                                        linkage: 'GALLERY',
                                        multiple: true,
                                        selectedIds: galleryIds,
                                        title: 'Campaign gallery',
                                        description:
                                            'Select images for this campaign gallery.',
                                    })
                                }
                            >
                                <Icon
                                    name="folder-image-line"
                                    className="text-2xl"
                                />
                                <span className="text-xs">
                                    Add gallery images
                                </span>
                            </button>
                        ) : (
                            <div className="grid grid-cols-3 gap-1.5">
                                {gallery.map((image, index) => (
                                    <button
                                        key={image.id}
                                        type="button"
                                        className="aspect-square overflow-hidden rounded-md border border-border bg-muted transition-opacity hover:opacity-90"
                                        onClick={() =>
                                            setGalleryPreviewIndex(index)
                                        }
                                    >
                                        <img
                                            src={image.src}
                                            alt={image.name || ''}
                                            className="size-full object-cover"
                                        />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </ToolPanel>
            </AccordionContent>
        </AccordionItem>
    );
}
