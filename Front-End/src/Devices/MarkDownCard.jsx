import React, { useState } from "react";
import "./Styles/WidgetStyle.css";

function MarkdownCard({ 
  title = "Information",
  defaultContent = "This is a customizable information card.\n\nYou can put instructions, notes, or system status here.",
  allowEditing = true 
}) {
  const [content, setContent] = useState(defaultContent);
  const [isEditing, setIsEditing] = useState(false);
  const [tempContent, setTempContent] = useState(defaultContent);

  const renderMarkdown = (text) => {
    if (!text) return "";

    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^\s*-\s+(.*$)/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      .replace(/\n/g, '<br>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  };

  const handleSave = () => {
    setContent(tempContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempContent(content);
    setIsEditing(false);
  };

  const handleEdit = () => {
    setTempContent(content);
    setIsEditing(true);
  };

  return (
    <div className="widget">
      <div className="widget-title">{title}</div>

      <div className="widget-content">
        {isEditing ? (
          <textarea
            value={tempContent}
            onChange={(e) => setTempContent(e.target.value)}
            placeholder="Write your content here... (Supports basic markdown: **bold**, *italic*, - lists, [links](url))"
            className="widget-textarea"
            rows={10}
          />
        ) : (
          <div 
            className="widget-body markdown-body"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        )}
      </div>

      {allowEditing && (
        <div className="widget-edit-area">
          {!isEditing ? (
            <button 
              className="widget-btn widget-btn-edit"
              onClick={handleEdit}
              title="Edit content"
            >
              ✏️ Edit
            </button>
          ) : (
            <div className="widget-edit-actions">
              <button 
                className="widget-btn widget-btn-secondary"
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button 
                className="widget-btn widget-btn-primary"
                onClick={handleSave}
              >
                Save Changes
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MarkdownCard;