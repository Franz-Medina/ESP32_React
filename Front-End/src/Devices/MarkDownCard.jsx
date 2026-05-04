import React, { useState } from "react";
import "./Styles/WidgetStyle.css";

function MarkdownCard({
  title = "Information",
  defaultContent = "This is a customizable information card.\n\nYou can put instructions, notes, or system status here.",
  allowEditing = true,
}) {
  const [content, setContent] = useState(defaultContent);
  const [isEditing, setIsEditing] = useState(false);
  const [tempContent, setTempContent] = useState(defaultContent);

  const renderMarkdown = (text) => {
    if (!text) return "";
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/^\s*-\s+(.*$)/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
      .replace(/\n/g, "<br>")
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      );
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
    <div className={`cs-widget md-widget ${isEditing ? "md-widget--editing" : ""}`}>
      <div className="cs-header">
        <span className="cs-title">{title}</span>

        {allowEditing && !isEditing && (
          <button
            className="md-edit-icon-btn"
            onClick={handleEdit}
            title="Edit content"
            aria-label="Edit card content"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          </button>
        )}
      </div>

      <div className="md-divider" />

      <div className="md-content-area">
        {isEditing ? (
          <textarea
            value={tempContent}
            onChange={(e) => setTempContent(e.target.value)}
            placeholder="Write your content here… (Supports **bold**, *italic*, - lists, [links](url))"
            className="md-textarea"
            autoFocus
          />
        ) : (
          <div
            className="md-body"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        )}
      </div>

      {allowEditing && isEditing && (
        <div className="md-actions">
          <button className="md-btn md-btn--cancel" onClick={handleCancel}>
            Cancel
          </button>
          <button className="md-btn md-btn--save" onClick={handleSave}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Save
          </button>
        </div>
      )}
    </div>
  );
}

export default MarkdownCard;