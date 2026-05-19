import { Button } from '../ui/button';
import { CardDescription } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Label } from '../ui/label';
import ContentRadioList from './ContentRadioList';
import RepresentativeCheckboxList from './RepresentativeCheckboxList';

export default function ContentAssignmentDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  warning,
  contents = [],
  selectedContentId,
  onSelectContent,
  representatives,
  selectedUserIds = [],
  onSelectedUserIdsChange,
  contentName = 'content',
  contentMaxHeightClass = 'max-h-64',
  showContentDescription = false,
  showRepresentativeEmail = false,
  representativeIdPrefix = 'rep',
  confirmLabel,
  confirmTestId,
  onConfirm,
}) {
  const canSelectRepresentatives = Array.isArray(representatives);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto bg-white dark:bg-gray-900">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </DialogHeader>

        <div className="mt-4 space-y-6">
          {warning}

          <div>
            <Label className="mb-3 block text-base font-semibold">Selecciona Contenido</Label>
            <ContentRadioList
              contents={contents}
              selectedContentId={selectedContentId}
              onSelectContent={onSelectContent}
              name={contentName}
              maxHeightClass={contentMaxHeightClass}
              showDescription={showContentDescription}
            />
          </div>

          {canSelectRepresentatives && (
            <div>
              <Label className="mb-3 block text-base font-semibold">Selecciona Representantes</Label>
              <RepresentativeCheckboxList
                representatives={representatives}
                selectedUserIds={selectedUserIds}
                onSelectedUserIdsChange={onSelectedUserIdsChange}
                idPrefix={representativeIdPrefix}
                showEmail={showRepresentativeEmail}
              />
            </div>
          )}

          <Button
            data-testid={confirmTestId}
            onClick={onConfirm}
            className="w-full bg-[#da2724] hover:bg-[#b8211e]"
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
